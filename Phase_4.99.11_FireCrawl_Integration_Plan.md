# Phase 4.99.11 — FireCrawl Integration: Intelligent Regulatory Source Monitoring & Full-Text Ingestion

---

## Problem Statement

Complyze's regulatory data pipeline has three weaknesses:

1. **RSS dependency**: The ingestion pipeline relies on RSS feeds, but most regulatory bodies don't maintain reliable RSS. The UK Legislation feed already had to be removed due to Vercel timeouts. EUR-Lex RSS has been flaky. State-level US legislation pages almost never have RSS.

2. **Summary-depth answers**: The RAG chatbot answers questions from manually curated `key_requirements` summaries (3-5 bullet points per regulation). When a compliance officer asks "What does Article 27 of the EU AI Act specifically require?", the chatbot can only give a summary — not cite the actual legislative text.

3. **Manual staleness detection**: There's no automated way to know when a regulatory source page has been updated. The ingestion pipeline runs weekly on a cron, but if a page hasn't changed, it wastes Gemini API calls. If a page changed mid-week, users don't find out until Monday.

FireCrawl solves all three.

---

## Architecture Overview

```
Current Pipeline:
RSS Feed → Gemini Classification → Human Approval → Supabase → Embeddings

New Pipeline (additive — doesn't replace RSS):
FireCrawl Scrape → Content Diff → Gemini Classification → Human Approval → Supabase → Embeddings
                 ↘ Full Text Chunks → Embedding Pipeline → pgvector (enhanced RAG)
```

Two parallel capabilities:
- **Track A: Change Detection** — Monitor regulatory source pages for updates, trigger the existing ingestion pipeline when changes are detected
- **Track B: Full-Text Ingestion** — Scrape complete legislative texts, chunk them, and embed them for deep RAG answers

---

## Track A: Regulatory Source Change Detection

### What It Does

Monitors 50-80 regulatory source URLs on a weekly schedule. When a page's content changes, it triggers the Gemini classification pipeline to extract what changed and create a `regulatory_update` entry. No change = no API calls wasted.

### Database Schema Addition

```sql
-- Add to existing feed_sources table or create new
CREATE TABLE scrape_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_id UUID REFERENCES regulations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  scrape_type TEXT NOT NULL CHECK (scrape_type IN ('full_page', 'section', 'pdf')),
  css_selector TEXT,              -- optional: target specific section of the page
  last_scraped_at TIMESTAMPTZ,
  last_content_hash TEXT,         -- SHA-256 of last scraped content
  last_content_text TEXT,         -- stored for diffing
  change_detected BOOLEAN DEFAULT FALSE,
  scrape_frequency TEXT DEFAULT 'weekly' CHECK (scrape_frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
  enabled BOOLEAN DEFAULT TRUE,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scrape_sources_regulation ON scrape_sources(regulation_id);
CREATE INDEX idx_scrape_sources_enabled ON scrape_sources(enabled, scrape_frequency);
```

### Source URL Mapping

For each of the 74 regulations, map to the authoritative source page:

```typescript
const REGULATORY_SOURCES: ScrapeSource[] = [
  // EU AI Act — monitor the EUR-Lex official text page
  {
    regulation_title: "EU Artificial Intelligence Act (Regulation 2024/1689)",
    url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689",
    source_name: "EUR-Lex",
    scrape_type: "full_page",
  },
  // NIST AI RMF — monitor the NIST publication page
  {
    regulation_title: "NIST AI Risk Management Framework (AI RMF 1.0)",
    url: "https://www.nist.gov/artificial-intelligence/ai-risk-management-framework",
    source_name: "NIST",
    scrape_type: "full_page",
  },
  // Colorado AI Act — monitor the state legislature page
  {
    regulation_title: "Colorado AI Act (SB 24-205)",
    url: "https://leg.colorado.gov/bills/sb24-205",
    source_name: "Colorado General Assembly",
    scrape_type: "full_page",
  },
  // FDA AI/ML — monitor the guidance page
  {
    regulation_title: "FDA AI/ML-Based Software as Medical Device (SaMD) Framework",
    url: "https://www.fda.gov/medical-devices/software-medical-device-samd/artificial-intelligence-and-machine-learning-aiml-enabled-medical-devices",
    source_name: "FDA",
    scrape_type: "full_page",
  },
  // Singapore IMDA — monitor the framework page
  {
    regulation_title: "Singapore Model AI Governance Framework for Agentic AI",
    url: "https://www.imda.gov.sg/resources/press-releases-factsheets-and-speeches/press-releases/2025/ai-governance-framework-for-agentic-ai",
    source_name: "IMDA Singapore",
    scrape_type: "full_page",
  },
  // ... map all 74 regulations to their source pages
  // Priority: enacted legislation > proposed bills > frameworks > guidance
];
```

### Scrape Pipeline API Route

`/api/scrape/monitor/route.ts`

```typescript
// Flow:
// 1. CRON_SECRET protected
// 2. Query all enabled scrape_sources for this frequency
// 3. For each source:
//    a. Call FireCrawl scrape API with the URL
//    b. Extract clean text content (FireCrawl handles JS rendering, popups, etc.)
//    c. Compute SHA-256 hash of the content
//    d. Compare to last_content_hash
//    e. If different:
//       - Store new hash and content
//       - Compute a diff (what text was added/removed/changed)
//       - Send the diff to Gemini for classification:
//         "The following regulatory source page has been updated. 
//          Regulation: {title}
//          Source: {url}
//          Changes detected:
//          {diff_text}
//          
//          Classify this change: Is it a new_regulation, amendment, 
//          status_change, enforcement_action, or guidance_update?
//          Extract: title, summary, and significance."
//       - Insert classified update into regulatory_updates (verified: false)
//       - Generate compliance_alerts for affected users
//       - Mark change_detected = true
//    f. If same: update last_scraped_at, skip classification
//    g. If error: increment error_count, log error, disable after 5 consecutive failures
// 4. Return summary: { sources_checked, changes_detected, errors }
```

### FireCrawl API Integration

```typescript
// src/lib/firecrawl/client.ts

interface FireCrawlScrapeOptions {
  url: string;
  formats?: ('markdown' | 'html' | 'text')[];
  onlyMainContent?: boolean;      // strip navs, footers, ads
  waitFor?: number;               // ms to wait for JS rendering
  timeout?: number;               // request timeout
  cssSelector?: string;           // target specific element
}

interface FireCrawlScrapeResult {
  success: boolean;
  data?: {
    markdown: string;
    html: string;
    metadata: {
      title: string;
      description: string;
      language: string;
      sourceURL: string;
    };
  };
  error?: string;
}

async function scrapeUrl(options: FireCrawlScrapeOptions): Promise<FireCrawlScrapeResult> {
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({
      url: options.url,
      formats: options.formats || ['markdown'],
      onlyMainContent: options.onlyMainContent ?? true,
      waitFor: options.waitFor || 3000,
      timeout: options.timeout || 30000,
    }),
  });
  return response.json();
}
```

### Content Diffing

```typescript
// src/lib/firecrawl/diff.ts

interface ContentDiff {
  has_changes: boolean;
  summary: string;           // "312 words added, 45 words removed, 3 sections modified"
  added_text: string;        // new content
  removed_text: string;      // deleted content
  changed_sections: string[]; // section headers that changed
}

function computeDiff(oldContent: string, newContent: string): ContentDiff {
  // Use a simple line-by-line diff algorithm
  // For regulatory pages, section-level changes are what matter
  // Split by headings (# or ## or numbered sections)
  // Compare sections individually
  // Return structured diff for Gemini to classify
}
```

### Cron Schedule

Add to `vercel.json`:
```json
{
  "path": "/api/scrape/monitor",
  "schedule": "0 5 * * 1"
}
```
Monday 5:00 AM UTC — runs BEFORE the ingestion pipeline (6 AM) so newly detected changes are available for the regular Monday processing cycle.

### Dashboard Integration

Add to the dashboard:
- "Source Monitoring" section showing: last scrape date, sources monitored count, changes detected this week
- In the alerts feed: "Regulatory source change detected: [regulation] — [change summary]"

---

## Track B: Full-Text Legislative Ingestion

### What It Does

Scrapes the complete text of enacted legislation and regulatory guidance documents, chunks them into semantic sections (articles, sections, paragraphs), and embeds them into pgvector. This gives the RAG chatbot access to the actual legislative text, not just summaries.

### Why This Matters

Current chatbot behavior when asked "What does Article 27 of the EU AI Act require?":
> "The EU AI Act requires fundamental rights impact assessments for high-risk AI systems."
> (Paraphrased from the 1-line key_requirement entry)

After full-text ingestion:
> "Article 27 requires deployers of high-risk AI systems to carry out a fundamental rights impact assessment. This assessment must be performed before putting the system into use and must include: (a) a description of the deployer's processes in which the high-risk AI system will be used; (b) a description of the period of time and frequency of use; (c) the categories of natural persons and groups likely to be affected; (d) the specific risks of harm likely to impact those persons..." 
> [EU AI Act, Article 27, European Union]

That's the difference between a summary tool and a compliance assistant.

### Chunking Strategy for Legislative Text

Legislative documents have natural hierarchical structure. The chunking strategy must preserve this:

```typescript
interface LegislativeChunk {
  regulation_id: string;
  chunk_type: 'article' | 'section' | 'recital' | 'annex' | 'definition' | 'preamble';
  chunk_reference: string;      // "Article 27" or "Section 5(a)(2)"
  chunk_title: string;          // "Fundamental rights impact assessment"
  chunk_text: string;           // The actual legislative text
  parent_reference: string;     // "Chapter III" or "Title II"
  hierarchy_path: string;       // "Title III > Chapter 2 > Article 27"
}
```

**Chunking rules:**
1. **Articles/Sections** are the primary chunk unit. Each article becomes one chunk.
2. **If an article exceeds 1000 tokens**, split by numbered paragraphs within the article, keeping the article reference in each sub-chunk.
3. **Recitals** (EU) or Preamble sections get chunked individually — they contain interpretive guidance that courts use.
4. **Definitions sections** get one chunk per defined term, prefixed with the regulation context.
5. **Annexes** get chunked by section/table.
6. Each chunk is prefixed with full context: `[EU AI Act | Article 27 | Chapter III — High-Risk AI Systems | European Union | Enacted]`

### Embedding Enhancement

Update `src/lib/ai/embeddings.ts` to handle two chunk sources:

```typescript
// Existing: chunks from key_requirements, compliance_implications, summaries
// New: chunks from full legislative text

// New chunk_types to add to the CHECK constraint:
// 'article', 'section', 'recital', 'annex', 'definition', 'preamble'
```

Migration addition:
```sql
ALTER TABLE regulation_embeddings 
  DROP CONSTRAINT regulation_embeddings_chunk_type_check;

ALTER TABLE regulation_embeddings 
  ADD CONSTRAINT regulation_embeddings_chunk_type_check 
  CHECK (chunk_type IN (
    'summary', 'key_requirement', 'compliance_implication',
    'penalty_info', 'full_text', 'update_summary',
    'article', 'section', 'recital', 'annex', 'definition', 'preamble'
  ));
```

### Full-Text Scrape Pipeline

`/api/scrape/fulltext/route.ts`

```typescript
// Flow:
// 1. CRON_SECRET protected
// 2. Accept { regulation_id } or process all regulations with scrape_sources
// 3. For each regulation:
//    a. Call FireCrawl to scrape the full legislative text
//    b. Use FireCrawl's markdown output (preserves structure)
//    c. Parse the markdown to identify articles, sections, recitals, etc.
//    d. Create LegislativeChunk entries for each identified section
//    e. Embed each chunk via the Gemini embedding API
//    f. Upsert into regulation_embeddings with the new chunk_types
//    g. Store the full scraped text in a new column: regulations.full_text_markdown
// 4. Return summary: { regulations_processed, chunks_created, embeddings_generated }
```

### Legislative Text Parser

```typescript
// src/lib/firecrawl/legislative-parser.ts

// EU legislation structure:
// Recitals (numbered: (1), (2), ...)
// Title I — General Provisions
//   Chapter 1 — ...
//     Article 1 — Subject matter
//     Article 2 — Scope
// Annexes

// US legislation structure:
// Section 1. Short title
// Section 2. Definitions
// Section 3. Requirements
// (a) Subsection
// (1) Paragraph
// (i) Subparagraph

// The parser needs to handle both styles
// Use regex patterns to identify structural markers
// Return an array of LegislativeChunk objects

function parseEULegislation(markdown: string, regulationId: string): LegislativeChunk[] {
  const chunks: LegislativeChunk[] = [];
  
  // Match recitals: lines starting with (N) 
  // Match articles: lines starting with "Article N" or "Art. N"
  // Match titles/chapters: lines starting with "TITLE" or "CHAPTER"
  // Track hierarchy for parent_reference and hierarchy_path
  
  return chunks;
}

function parseUSLegislation(markdown: string, regulationId: string): LegislativeChunk[] {
  const chunks: LegislativeChunk[] = [];
  
  // Match sections: "Section N." or "Sec. N."
  // Match subsections: "(a)", "(b)", etc.
  // Match definitions: terms followed by "means" or "—"
  
  return chunks;
}

function parseGenericRegulation(markdown: string, regulationId: string): LegislativeChunk[] {
  // Fallback: split by headings (# and ##)
  // Each heading becomes a chunk boundary
  return chunks;
}
```

### Priority Source List for Full-Text Ingestion

Not all 74 regulations need full-text ingestion. Prioritize by:
1. **Most queried** (track chatbot questions to identify demand)
2. **Enacted with enforcement** (users need specific article citations)
3. **Available in English with clean HTML structure**

Initial targets (10 regulations for v1):

| Regulation | Source URL | Parser Type | Est. Chunks |
|-----------|-----------|------------|------------|
| EU AI Act | EUR-Lex | EU legislation | ~150 |
| GDPR (AI provisions) | EUR-Lex | EU legislation | ~30 (AI-relevant articles only) |
| DORA | EUR-Lex | EU legislation | ~80 |
| Colorado AI Act | Colorado Legislature | US legislation | ~25 |
| Texas TRAIGA | Texas Legislature | US legislation | ~20 |
| California AI Transparency Act | California Legislature | US legislation | ~15 |
| NIST AI RMF | NIST.gov | Generic | ~40 |
| Singapore Agentic AI Framework | IMDA | Generic | ~20 |
| Brazil AI Bill | Brazilian Congress | Generic | ~30 |
| Illinois AIVI + BIPA | Illinois Legislature | US legislation | ~15 |

**Estimated total: ~425 new chunks from 10 regulations**
Combined with existing 693 summary chunks = ~1,118 total chunks in pgvector.

### Database Addition

Add a column to regulations for full text storage:
```sql
ALTER TABLE regulations ADD COLUMN full_text_markdown TEXT;
ALTER TABLE regulations ADD COLUMN full_text_source TEXT;
ALTER TABLE regulations ADD COLUMN full_text_scraped_at TIMESTAMPTZ;
```

---

## Environment Variables

```
FIRECRAWL_API_KEY=fc-xxxxxxxxxxxxxxxx
```

Add to `.env.example` and Vercel environment variables.

---

## FireCrawl Credit Budget

**Free tier: 500 credits/month**

Credit usage:
- Each scrape = 1 credit
- Change detection (Track A): 74 sources × 4 weekly scrapes = ~296 credits/month
- Full-text ingestion (Track B): 10 regulations × 1 scrape each = 10 credits (one-time)
- Buffer for retries and new sources: ~194 credits

**This fits within the free tier.** If you scale to 150+ sources or add daily monitoring for high-priority regulations, upgrade to the Hobby tier ($16/month for 3,000 credits).

---

## Implementation Order

| Order | Component | Effort | Dependencies |
|-------|----------|--------|-------------|
| 1 | FireCrawl client (`src/lib/firecrawl/client.ts`) | Small | FIRECRAWL_API_KEY |
| 2 | Scrape sources table (migration) | Small | None |
| 3 | Content diffing utility | Small | None |
| 4 | Change detection pipeline (`/api/scrape/monitor`) | Medium | Steps 1-3 |
| 5 | Seed scrape_sources with URLs for 74 regulations | Medium | Step 2 |
| 6 | Dashboard integration (source monitoring widget) | Small | Step 4 |
| 7 | Legislative text parser | Medium | None |
| 8 | Full-text scrape pipeline (`/api/scrape/fulltext`) | Medium | Steps 1, 7 |
| 9 | Embedding pipeline update (new chunk_types) | Small | Step 8 |
| 10 | Migration for regulations.full_text_markdown | Small | None |
| 11 | Scrape + embed 10 priority regulations | Large | Steps 8-10 |
| 12 | Cron configuration for weekly monitoring | Small | Step 4 |

**Estimated total: 3-4 Claude Code sessions**

---

## Verification Plan

### Track A — Change Detection
1. Add a test source (a page you control or a known-changing page)
2. Run the monitor pipeline, verify it scrapes and stores the hash
3. Modify the page (or use a different URL), re-run, verify change detection triggers
4. Verify Gemini classifies the change and creates a `regulatory_update`
5. Verify a `compliance_alert` is generated for affected users
6. Verify the dashboard shows the change

### Track B — Full-Text Ingestion
1. Scrape the EU AI Act from EUR-Lex
2. Verify the parser identifies articles, recitals, and annexes correctly
3. Verify chunks are created with proper hierarchy_path and chunk_reference
4. Verify embeddings are generated (768-dim vectors in pgvector)
5. Ask the chatbot: "What does Article 27 of the EU AI Act specifically require?"
6. Verify the response cites specific article text, not just the summary
7. Compare answer quality before/after full-text ingestion

### Credit Monitoring
1. Track FireCrawl credit usage after each pipeline run
2. Alert if usage exceeds 80% of monthly allocation
3. Log credit usage per source for optimization

---

## Quality Bar

1. **No stale data without detection**: If a regulatory source page changes, the system must detect it within the next scrape cycle (weekly for most sources, daily for high-priority)
2. **No phantom updates**: Content diffing must ignore boilerplate changes (footer dates, ad content, navigation changes). Only substantive text changes trigger classification.
3. **Accurate parsing**: Legislative chunk boundaries must align with actual article/section boundaries. A chunk should never split a sentence mid-thought.
4. **Source attribution**: Every full-text chunk must carry its article/section reference so the chatbot can cite "Article 27" not just "EU AI Act"
5. **Graceful failure**: If FireCrawl is unavailable or a scrape fails, the existing RSS pipeline continues working. FireCrawl is additive, not a replacement.
6. **Budget awareness**: The pipeline must track and log credit usage. It must never exceed the monthly credit allocation without explicit override.

---

## Future Extensions (Phase 5+)

- **Real-time monitoring**: For the 5-10 highest-priority regulations, switch from weekly to daily scraping. Detect changes within 24 hours.
- **PDF scraping**: Many regulatory documents are published as PDFs (NIST, FDA, ISO). FireCrawl supports PDF extraction. Add PDF source type.
- **Multi-language support**: Scrape non-English sources (Japan METI in Japanese, Brazil AI Bill in Portuguese) and use Gemini to translate before embedding.
- **Automatic regulation discovery**: Scrape regulatory body landing pages (EU Commission, US Congress AI committee) to detect entirely new regulations that aren't in the database yet.
- **Competitive monitoring**: Scrape competitor compliance platforms to track what regulations they cover — identify gaps in your coverage before users notice.
