# Phase 4: Intelligent Features + UI Overhaul — Master Build Prompt

---

## Context

You are continuing the build of the **Complyze Compliance Intelligence System** (formerly OpenClaw). Phases 1 through 3 are complete, deployed, and verified:

- **Phase 1 (Live Regulatory Feed)**: Supabase database with 12 seeded regulations, paginated/filterable API, regulatory feed UI with jurisdiction/status badges, Gemini-powered ingestion pipeline with CRON_SECRET auth, human-in-the-loop verification flags. All passing.
- **Phase 2 (Configuration Auditor)**: Gemini-powered audit engine producing grounded compliance reports with zero hallucinated citations, jurisdiction-grouped findings, severity filtering, tabbed findings/recommendations view, audit history stored in Supabase. All passing.
- **Phase 3 (Personalized Dashboard + Advanced Features)**: Supabase Auth (email/password + magic link), onboarding wizard, personalized dashboard with compliance score gauge, interactive world map with pulsing jurisdiction indicators, compliance cost estimator, regulatory velocity scores, "What Changed This Week" Gemini-synthesized digest, compliance alerts system, 5 industry-specific example configs, full responsive design. All passing and deployed.

The existing codebase is in `~/openclaw-compliance`. The Supabase project has tables: `regulations`, `regulatory_updates`, `ingestion_logs`, `audit_reports`, `user_profiles`, `compliance_alerts`, `posture_snapshots`, `weekly_digests`. The app uses Next.js 14+ (App Router), Supabase (PostgreSQL + Auth + RLS), Gemini API (gemini-2.5-flash), Tailwind CSS, shadcn/ui, and Vercel for deployment.

**The UI/UX Pro Max skill has been installed in the project** at `.claude/skills/ui-ux-pro-max/`. Before building any UI components in this phase, generate a design system by running:
```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py \
  "regulatory compliance SaaS dashboard" \
  --design-system --persist -p "Complyze"
```
Read the resulting `design-system/MASTER.md` before writing any UI code. Apply its color palette, typography, spacing, and component patterns consistently across all new and updated pages.

**Continue operating with the same three mindsets from the original build prompt: Architect, Builder, Project Manager. Follow the phased steps exactly. Do not skip ahead.**

---

## Phase 4 Overview

Phase 4 transforms Complyze from a compliance monitoring platform into an **intelligent compliance assistant** — one that answers questions, generates policy documents, and presents a polished, professional interface worthy of enterprise adoption. It adds six capabilities in priority order:

| Priority | Feature | What It Does | Why It Matters |
|----------|---------|-------------|----------------|
| 1 | **RAG Chatbot** | Floating chat widget on every page that answers regulatory questions grounded in the live regulation database using vector search | Users get instant, cited answers instead of reading through 80+ regulations. The feature that makes people say "this replaces my research analyst" |
| 2 | **Policy Document Generator** | Takes a regulation + user's industry context and generates a draft internal compliance policy rendered as editable Markdown | Turns regulatory requirements into actionable internal documents. Saves legal teams weeks of drafting time |
| 3 | **UI Refresh** | Complete visual overhaul guided by UI/UX Pro Max design system — professional, distinctive, anti-generic | First impressions determine adoption. A polished UI signals "this is a real product" not "this is a side project" |
| 4 | **PDF Export of Audit Reports** | Professional, branded PDF of the full audit report downloadable from the audit results page | Compliance officers share reports with people who won't visit a URL. PDF is the universal compliance format |
| 5 | **Data Expansion** | Scale from 12 seeded regulations to 50-80+ covering DORA, MiCA, SEC AI guidance, HIPAA AI, FDA AI/ML, and industry-specific AI regulations | Depth of regulatory coverage is the #1 credibility signal. 12 regulations is a demo. 80+ is a product |
| 6 | **Regulation Dependency Graph** | Interactive D3.js visualization showing how regulations trigger, require, or conflict with each other across jurisdictions | Nobody has built this for AI regulations. It's the screenshot that gets shared on LinkedIn |

---

## Instructional Guidance and Constraints

### Step 4.1 — Database Schema (Supabase Migration 004)

Generate `supabase/migrations/004_phase4_features.sql` for manual execution in Supabase SQL Editor. Include these additions:

**Enable pgvector extension:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**regulation_embeddings (vector store for RAG):**
```sql
CREATE TABLE regulation_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_id UUID REFERENCES regulations(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_type TEXT NOT NULL CHECK (chunk_type IN (
    'summary', 'key_requirement', 'compliance_implication',
    'penalty_info', 'full_text', 'update_summary'
  )),
  embedding vector(768) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(regulation_id, chunk_index)
);

-- HNSW index for fast similarity search
CREATE INDEX idx_embeddings_vector ON regulation_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_embeddings_regulation ON regulation_embeddings(regulation_id);
CREATE INDEX idx_embeddings_type ON regulation_embeddings(chunk_type);
```

**chat_sessions (conversation history):**
```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id, updated_at DESC);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at ASC);
```

**policy_documents (generated policies):**
```sql
CREATE TABLE policy_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  regulation_id UUID REFERENCES regulations(id) ON DELETE SET NULL,
  industry TEXT,
  jurisdictions TEXT[] DEFAULT '{}',
  content_markdown TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'archived')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_policies_user ON policy_documents(user_id, updated_at DESC);
CREATE INDEX idx_policies_regulation ON policy_documents(regulation_id);
```

**regulation_relationships (dependency graph):**
```sql
CREATE TABLE regulation_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_regulation_id UUID REFERENCES regulations(id) ON DELETE CASCADE,
  target_regulation_id UUID REFERENCES regulations(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'triggers', 'requires', 'conflicts_with', 'supplements', 'supersedes', 'references'
  )),
  description TEXT,
  strength TEXT DEFAULT 'strong' CHECK (strength IN ('strong', 'moderate', 'weak')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_regulation_id, target_regulation_id, relationship_type)
);

CREATE INDEX idx_relationships_source ON regulation_relationships(source_regulation_id);
CREATE INDEX idx_relationships_target ON regulation_relationships(target_regulation_id);
```

Include RLS policies:
- regulation_embeddings: Public read (same as regulations — these are public data)
- chat_sessions and chat_messages: Users can only read/create their own
- policy_documents: Users can only CRUD their own
- regulation_relationships: Public read, service role write

### Step 4.2 — Embedding Pipeline

Build the vector embedding infrastructure that powers both the RAG chatbot and future semantic search features.

**Embedding model:** Use Gemini's embedding model (`text-embedding-004` via the `@google/generative-ai` package). This produces 768-dimensional vectors compatible with the pgvector column.

**Chunking strategy (`src/lib/ai/embeddings.ts`):**

For each regulation in the database, create the following chunks:
1. **Summary chunk** — The regulation's `summary` field (chunk_type: `summary`)
2. **Key requirement chunks** — One chunk per entry in the `key_requirements` JSONB array (chunk_type: `key_requirement`). Each chunk includes the requirement text prefixed with the regulation title and jurisdiction for context
3. **Compliance implication chunks** — One chunk per entry in `compliance_implications` JSONB array (chunk_type: `compliance_implication`)
4. **Penalty chunk** — A synthesized text combining all penalty-related data from `compliance_implications` (chunk_type: `penalty_info`)
5. **Update summary chunks** — For each `regulatory_update` linked to the regulation, embed the update title + summary (chunk_type: `update_summary`)

**Chunk text format:**
Each chunk should be self-contained and include context. Example format:
```
[EU AI Act | European Union | Enacted]
Key Requirement: Providers of high-risk AI systems must establish a risk management system that is a continuous, iterative process planned and run throughout the entire lifecycle of the high-risk AI system. (Article 9)
```

This context-enriched format ensures the vector search returns meaningful results even when chunks are retrieved in isolation.

**Embedding API route (`/api/embeddings/generate/route.ts`):**
- Protected by CRON_SECRET
- Fetches all regulations and their updates from Supabase
- Chunks each regulation using the strategy above
- Calls Gemini embedding API for each chunk (batch where possible)
- Upserts into `regulation_embeddings` table (update if chunk already exists, insert if new)
- Rate limit: max 100 embedding calls per run with exponential backoff
- Log results: total chunks processed, new, updated, failed

**Embedding search function (`src/lib/ai/search.ts`):**
```typescript
interface SearchResult {
  chunk_text: string;
  chunk_type: string;
  regulation_id: string;
  regulation_title: string;
  jurisdiction: string;
  similarity: number;
}

async function semanticSearch(
  query: string,
  options?: {
    limit?: number;          // default 5
    threshold?: number;      // minimum similarity, default 0.7
    jurisdictions?: string[]; // filter by jurisdiction
    chunk_types?: string[];   // filter by chunk type
  }
): Promise<SearchResult[]>
```

The search function:
1. Embeds the query using the same Gemini embedding model
2. Performs a cosine similarity search against `regulation_embeddings` using pgvector's `<=>` operator
3. Joins with `regulations` table to include title, jurisdiction, and source URL
4. Optionally filters by jurisdiction (if user has a profile with tracked jurisdictions) and chunk type
5. Returns top-k results above the similarity threshold

**Supabase RPC function** for the vector search (create in migration):
```sql
CREATE OR REPLACE FUNCTION match_regulations(
  query_embedding vector(768),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5,
  filter_jurisdictions TEXT[] DEFAULT NULL,
  filter_chunk_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  regulation_id UUID,
  chunk_text TEXT,
  chunk_type TEXT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    re.id,
    re.regulation_id,
    re.chunk_text,
    re.chunk_type,
    1 - (re.embedding <=> query_embedding) AS similarity,
    re.metadata
  FROM regulation_embeddings re
  WHERE 1 - (re.embedding <=> query_embedding) > match_threshold
    AND (filter_jurisdictions IS NULL OR
         EXISTS (
           SELECT 1 FROM regulations r
           WHERE r.id = re.regulation_id
           AND r.jurisdiction = ANY(filter_jurisdictions)
         ))
    AND (filter_chunk_types IS NULL OR re.chunk_type = ANY(filter_chunk_types))
  ORDER BY re.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### Step 4.3 — RAG Chatbot

Build a floating chat widget that appears on every page and answers regulatory compliance questions grounded in the live regulation database.

**Chat API route (`/api/chat/route.ts`):**

POST endpoint that:
1. Accepts `{ message, session_id?, jurisdictions? }`
2. If `session_id` is null, creates a new `chat_session`
3. Stores the user message in `chat_messages`
4. Calls `semanticSearch()` with the user's message to retrieve relevant regulation chunks
5. Constructs a Gemini API prompt with the retrieved context
6. Streams the response back to the client
7. Stores the assistant response with citations in `chat_messages`

**Gemini RAG prompt (`src/lib/ai/prompts/chat-rag.ts`):**

```
You are a regulatory compliance analyst for Complyze, an AI compliance intelligence platform. Answer the user's question using ONLY the regulatory context provided below. 

RULES:
1. Ground every claim in the provided regulation excerpts. Cite the specific regulation by name and jurisdiction.
2. If the context does not contain enough information to answer the question, say so explicitly — never fabricate regulatory requirements.
3. If the user asks about a jurisdiction or regulation not covered in the context, state that it is not currently in the database and suggest they check the regulatory feed.
4. Write for a compliance professional audience — clear, precise, actionable. No filler.
5. When multiple regulations apply, compare their requirements and note conflicts or overlaps.
6. Include penalty exposure information when relevant to the question.
7. Format citations as: [Regulation Title, Jurisdiction]

USER'S PROFILE:
- Industry: {user.industry || 'Not specified'}
- Tracked jurisdictions: {user.jurisdictions || 'All'}

REGULATORY CONTEXT (retrieved from database):
{retrieved_chunks}

CONVERSATION HISTORY:
{last_5_messages}

USER'S QUESTION:
{message}
```

**Critical constraint:** The same zero-hallucination bar from Phase 2 applies. The chatbot must never cite a regulation that does not exist in the database. If asked about something outside the database, it must say so.

**Streaming implementation:**
Use the Gemini API's streaming mode. The chat API route should return a `ReadableStream` so the UI can display tokens as they arrive. Use the `streamText` pattern or a custom `TransformStream` to forward Gemini's streamed response.

**Chat UI component (`src/components/chat/ChatWidget.tsx`):**

Floating widget positioned at bottom-right of every page:
- **Collapsed state**: Circular button with a chat icon and unread indicator. Subtle pulsing animation on first visit to draw attention.
- **Expanded state**: Chat panel (400px wide, 500px tall on desktop; full-screen sheet on mobile) with:
  - Header: "Complyze AI" with minimize and close buttons
  - Message list: User messages right-aligned, assistant messages left-aligned with Complyze branding
  - Citations: Each cited regulation appears as a clickable chip below the message that links to the regulation in the feed
  - Typing indicator while Gemini is generating
  - Input bar: Text input with send button, placeholder "Ask about any AI regulation..."
  - Suggested starter questions on empty state:
    - "What are the EU AI Act penalties for non-compliance?"
    - "Which regulations require human oversight of AI decisions?"
    - "Compare US and EU requirements for AI transparency"
    - "What are the deadlines I should track this quarter?"

**Placement:** Add the `<ChatWidget />` component to `src/app/layout.tsx` so it renders on every page. Only show it if the user is authenticated (anonymous users see a "Sign in to use the AI assistant" prompt in the collapsed button tooltip).

**Conversation persistence:**
- Chat sessions are stored in Supabase and persist across page navigations
- The widget maintains the current session until the user explicitly starts a new conversation
- Show a "New conversation" button in the chat header
- Session title is auto-generated from the first user message (truncated to 50 chars)

### Step 4.4 — Policy Document Generator

Build a feature that generates draft internal compliance policies from regulation data, tailored to the user's industry and organizational context.

**User flow:**
1. User navigates to `/policies` (new page, auth-gated) or clicks "Generate Policy" from a regulation detail view
2. User selects:
   - **Source regulation(s)** — dropdown/multi-select of regulations from the database
   - **Policy type** — dropdown: Acceptable Use Policy, Data Governance Policy, AI Risk Management Policy, Human Oversight Policy, Transparency & Disclosure Policy, Incident Response Policy, Vendor/Third-Party AI Policy, Model Governance Policy
   - **Industry context** — pre-filled from user profile, editable
   - **Organizational details** (optional) — company name, department, additional context
3. User clicks "Generate Policy"
4. AI generates a structured Markdown policy document
5. Document renders in a split-pane view: rendered preview on one side, raw Markdown editor on the other
6. User can edit the Markdown directly and see live preview
7. "Copy Markdown" and "Save to My Policies" buttons

**Policy generation API route (`/api/policies/generate/route.ts`):**

POST endpoint that:
1. Accepts `{ regulation_ids, policy_type, industry, organization_details? }`
2. Fetches the full regulation data for the selected regulations (including `key_requirements` and `compliance_implications`)
3. Calls Gemini API with the policy generation prompt
4. Returns the generated Markdown
5. Does NOT auto-save — user explicitly saves after reviewing/editing

**Gemini policy prompt (`src/lib/ai/prompts/generate-policy.ts`):**

```
You are a compliance policy architect. Generate a professional internal compliance policy document based on the regulatory requirements provided.

POLICY TYPE: {policy_type}
INDUSTRY: {industry}
ORGANIZATION: {organization_details || 'Not specified — write in generic corporate language'}

REGULATORY REQUIREMENTS:
{regulation_data — full key_requirements and compliance_implications for each selected regulation}

DOCUMENT STRUCTURE:
1. Policy Title
2. Document Control (Version, Effective Date placeholder, Owner placeholder, Review Cycle)
3. Purpose & Scope
   - Why this policy exists (tied directly to the regulatory requirements)
   - Who it applies to
   - What systems, processes, or AI applications it covers
4. Definitions
   - Key terms from the regulations, defined in plain language
5. Policy Statements
   - Numbered, specific, actionable requirements
   - Each statement must map to a specific regulatory requirement — include the citation
   - Use "shall" for mandatory requirements, "should" for recommended practices
6. Roles & Responsibilities
   - RACI-style mapping: who is Responsible, Accountable, Consulted, Informed
   - Include placeholders for specific role titles
7. Implementation Requirements
   - Technical controls needed
   - Process changes needed
   - Training requirements
8. Monitoring & Enforcement
   - How compliance with this policy will be measured
   - Reporting requirements
   - Consequences of non-compliance
9. Review & Update Schedule
   - Linked to regulatory update cadence
10. Appendices
   - Regulatory reference table (regulation name, jurisdiction, relevant articles/sections)
   - Related internal policies (placeholders)

RULES:
1. Every policy statement must cite the specific regulation and requirement it implements
2. Use professional legal/compliance language appropriate for board-level review
3. Include placeholders in [BRACKETS] for organization-specific details the user must fill in
4. The policy must be implementable — no aspirational platitudes, only concrete requirements
5. Include version control metadata at the top of the document
6. Keep the total document between 1500–3000 words depending on complexity
```

**Policy management page (`/policies/page.tsx`):**

Auth-gated page with two views:
- **Generate tab**: The policy generation wizard described above
- **My Policies tab**: List of saved policy documents with:
  - Title, source regulation(s), policy type badge, status badge (draft/review/approved/archived)
  - Last updated timestamp
  - Click to open in the split-pane editor
  - Delete button with confirmation

**Split-pane editor component (`src/components/policies/PolicyEditor.tsx`):**
- Left pane: Raw Markdown editor (use a monospace textarea or a lightweight Markdown editor like `@uiw/react-md-editor` if available, otherwise a styled textarea)
- Right pane: Live rendered Markdown preview using `react-markdown` or similar
- Toolbar: Copy Markdown, Save, Update Status (draft → review → approved), Delete
- Auto-save indicator when changes are detected

### Step 4.5 — UI Refresh

Apply a comprehensive visual overhaul to every page in the application, guided by the UI/UX Pro Max design system.

**Before writing any UI code for this step:**
1. Run the design system generator if not already done:
```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py \
  "regulatory compliance SaaS dashboard" \
  --design-system --persist -p "Complyze"
```
2. Read `design-system/MASTER.md` and apply its recommendations
3. Generate page-specific overrides for key pages:
```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py \
  "data analytics dashboard charts" \
  --design-system --persist -p "Complyze" --page "dashboard"

python3 .claude/skills/ui-ux-pro-max/scripts/search.py \
  "regulatory data feed list view" \
  --design-system --persist -p "Complyze" --page "feed"

python3 .claude/skills/ui-ux-pro-max/scripts/search.py \
  "code audit security report" \
  --design-system --persist -p "Complyze" --page "audit"
```

**Scope of refresh — every page gets updated:**

**Landing page (`/`):**
- Hero section redesign with a compelling visual (not generic gradient background)
- Updated statistics display (regulation count, jurisdiction count, audit count)
- Feature showcase section highlighting the new RAG chatbot and policy generator
- Social proof section (if applicable — audit count, user count)
- Clear CTAs to Feed, Audit, Dashboard, and new Policies page
- Footer refresh

**Feed page (`/feed`):**
- RegulationCard redesign — more visual hierarchy, better use of badges, improved readability
- Filter bar refresh — cleaner layout, better mobile behavior
- Update timeline visual improvement
- Add visual indicator for regulations that have embeddings (searchable by AI)

**Audit page (`/audit`):**
- Config input area redesign
- Example config selector card refresh
- Audit results: improved layout for the summary header, jurisdiction cards, and finding cards
- Better severity color system
- Add "Download PDF" button placement (for Step 4.6)

**Dashboard (`/dashboard`):**
- Compliance score gauge redesign
- Jurisdiction cards visual refresh
- World map: apply updated color scheme from design system
- Charts: consistent styling with new color palette
- Alerts feed: improved card design
- Digest display: better typography and visual hierarchy

**Auth pages (`/auth/*`):**
- Sign-in and sign-up page refresh — clean, branded, professional
- Onboarding wizard: updated step indicators, better card designs

**Navigation:**
- Add "Policies" to the main navigation (between Audit and Dashboard)
- Add "AI Assistant" indicator in the nav showing the chat widget is available
- Refresh mobile hamburger menu styling

**Global changes:**
- Update CSS variables in the root layout to match MASTER.md color palette
- Update font imports to match MASTER.md typography recommendations
- Consistent spacing scale across all components
- Improved dark mode contrast ratios (if applicable based on design system)
- Smooth page transitions
- Loading skeleton states for all async content

### Step 4.6 — PDF Export of Audit Reports

Add a professional PDF export to the audit results page.

**Implementation approach:**
Use a server-side PDF generation approach. The API route receives the audit report data and generates a formatted PDF using a library like `@react-pdf/renderer` (for React-based PDF templates) or `puppeteer` (for HTML-to-PDF). If using puppeteer adds too much to the Vercel serverless bundle, fall back to `jspdf` with `jspdf-autotable` for table formatting.

**PDF API route (`/api/audit/[id]/pdf/route.ts`):**
- GET endpoint that accepts an audit report ID
- Fetches the full audit report from Supabase
- Generates a formatted PDF
- Returns the PDF as a downloadable file with `Content-Disposition: attachment`

**PDF content and layout:**

**Page 1 — Cover Page:**
- Complyze logo and branding
- "AI Compliance Audit Report"
- Configuration name and description
- Overall risk level badge (large, centered)
- Generation date and data freshness timestamp
- "Generated by Complyze — complyze.dev"

**Page 2 — Executive Summary:**
- Overall risk score (0-100) with visual gauge
- Finding counts by severity (critical/high/medium/low/info) as a summary bar
- Number of jurisdictions analyzed
- Number of regulations checked
- Top 3 critical findings (title + one-line summary each)
- Total penalty exposure (from cost estimator)
- Estimated remediation cost

**Page 3+ — Jurisdiction Breakdown:**
- One section per jurisdiction with findings
- Jurisdiction name, compliance score, applicable regulation count
- Table of findings for that jurisdiction: severity, title, regulation, config reference

**Remaining pages — Detailed Findings:**
- Each finding gets a structured entry:
  - Severity badge + Finding title
  - Description
  - Regulation citation (title, jurisdiction, source URL)
  - Specific requirement violated
  - Config field reference
  - Recommended remediation
- Findings grouped by severity (critical first, then high, medium, low, info)

**Final page — Recommendations Summary:**
- Prioritized list of all remediation recommendations
- Cost analysis summary (penalty exposure vs remediation cost)
- "Next steps" section

**Footer on every page:**
- Page number
- "Confidential — Generated [date] by Complyze"
- Data freshness timestamp

**UI integration:**
- Add a "Download PDF" button to the audit results page header, next to the existing "Copy Report as JSON" button
- Loading state while PDF generates (may take 2-3 seconds)
- Button text: "Download PDF Report"

### Step 4.7 — Data Expansion

Scale the regulatory database from 12 seeded regulations to 50-80+ entries covering a comprehensive global landscape of AI-relevant regulations.

**New regulations to add (organized by region):**

**European Union (expand from 2 to 10+):**
- Digital Operational Resilience Act (DORA) — In effect Jan 17 2025, financial services ICT risk
- Markets in Crypto-Assets (MiCA) — In effect, AI-driven trading and crypto asset management
- Digital Services Act (DSA) — In effect Feb 17 2024, algorithmic transparency requirements
- Digital Markets Act (DMA) — In effect May 2 2023, AI in gatekeeper platform obligations
- GDPR (as it relates to AI) — Automated decision-making rights under Article 22
- EU Product Liability Directive (revised) — AI systems as products, strict liability
- EU AI Liability Directive — Proposed, burden of proof for AI-caused harm

**United States (expand from 4 to 15+):**
- SEC AI Guidance (Reg S-P Amendments) — AI in financial advisory, algorithmic trading
- FTC AI Enforcement Actions — Section 5 unfairness doctrine applied to AI
- NIST AI 600-1 (Generative AI Profile) — Companion to AI RMF for GenAI risks
- NYC Local Law 144 — Automated employment decision tools, bias audits
- Utah AI Policy Act — Enacted 2024, disclosure requirements for AI interactions
- Tennessee ELVIS Act — AI voice and likeness protections
- FDA AI/ML Framework — AI in medical devices, SaMD guidance
- HIPAA AI Guidance — AI in healthcare data processing
- CCPA/CPRA Automated Decision-Making — California privacy rights for AI profiling
- Executive Order 14110 (Biden AI EO) — Federal AI governance (note: status may have changed under subsequent administration — verify current status)
- Virginia Consumer Data Protection Act (VCDPA) — AI profiling provisions
- Connecticut SB 2 (AI Act) — Proposed, high-risk AI system requirements

**Asia-Pacific (expand from 2 to 8+):**
- China AI Regulations (Interim Measures for GenAI) — In effect Aug 15 2023
- China Algorithm Recommendation Regulations — In effect Mar 1 2022
- Japan AI Strategy and Guidelines — Voluntary, METI guidelines
- South Korea AI Basic Act — Proposed, comprehensive AI framework
- Australia AI Ethics Principles — Voluntary, government-endorsed
- India Digital Personal Data Protection Act — In effect, AI data processing
- Philippines Data Privacy Act — AI provisions in NPC guidelines
- Thailand Personal Data Protection Act (PDPA) — AI implications

**Other Regions (expand from 2 to 6+):**
- Brazil AI Bill (update existing entry if status has changed)
- Mexico AI Regulation — Proposed legislative efforts
- Saudi Arabia National AI Strategy / NDMO regulations
- UAE AI Governance Principles
- Israel Privacy Protection Authority AI Guidelines
- Nigeria Data Protection Act — AI provisions
- South Africa POPIA — AI and automated decision-making provisions

**Seed data requirements:**
- Every regulation entry must populate ALL columns in the `regulations` table
- All `source_url` fields must point to real, verifiable sources
- `ai_classified` should be `false` for all manually seeded data
- `last_verified_at` should be set to the date of seeding
- `key_requirements` JSONB must contain at least 3-5 specific requirements per regulation
- `compliance_implications` JSONB must include penalty data where available
- Update the `effective_date` for all entries based on current status

**Implementation:**
1. Create `src/lib/seed/regulations-expanded.ts` with all new regulation data
2. Create a seed API route or script that can be run to insert the expanded dataset
3. After seeding, run the embedding pipeline (`/api/embeddings/generate`) to generate vectors for all new regulations
4. Verify the RAG chatbot can answer questions about the newly added regulations

**Quality bar:** Same as Phase 1 — every regulation must be real, accurately summarized, and verifiably sourced. No fabricated regulations. No hallucinated penalties or requirements. Cross-check effective dates, source URLs, and penalty amounts against authoritative sources.

### Step 4.8 — Regulation Dependency Graph

Build an interactive visualization showing how AI regulations trigger, require, or conflict with each other.

**Seed the relationship data:**

Create `src/lib/seed/regulation-relationships.ts` with curated relationships. Examples of real regulatory dependencies:

- EU AI Act → **triggers** GDPR obligations (AI systems processing personal data must comply with GDPR)
- EU AI Act → **requires** CE Marking / EU Product Liability compliance for high-risk systems
- GDPR Article 22 → **supplements** EU AI Act (automated decision-making rights)
- EU AI Act → **references** NIST AI RMF (international standards alignment)
- DORA → **supplements** EU AI Act (financial services AI must meet DORA ICT resilience requirements)
- DSA → **supplements** EU AI Act (algorithmic transparency for platforms)
- California AI Transparency Act → **references** NIST AI RMF
- Colorado AI Act → **references** NIST AI RMF (explicitly requires conformance)
- Texas TRAIGA → **conflicts_with** Colorado AI Act (different compliance thresholds)
- HIPAA → **triggers** FDA AI/ML Framework (AI in healthcare intersects both)
- Singapore Agentic AI Framework → **references** OECD AI Principles
- Indonesia UU PDP → **triggers** GDPR (data transfer requirements for EU-Indonesia data flows)
- Brazil AI Bill → **references** EU AI Act (modeled on EU risk-based approach)

Include 30-50 relationships covering the most significant regulatory interconnections. Each relationship must be real and defensible — no fabricated connections.

**Visualization component (`src/components/graph/DependencyGraph.tsx`):**

Build using D3.js (force-directed graph):
- **Nodes**: Regulations, sized by the number of connections. Color by jurisdiction region (EU = blue, US = red, APAC = green, LATAM = amber, etc.)
- **Edges**: Directed arrows colored by relationship type:
  - `triggers` = red (strongest dependency)
  - `requires` = orange
  - `conflicts_with` = red dashed line
  - `supplements` = blue
  - `supersedes` = gray
  - `references` = light gray dotted
- **Interactions**:
  - Hover on a node: highlight all connected nodes and edges, dim everything else
  - Click a node: show a detail panel with the regulation summary, all connections listed, and a "View in Feed" link
  - Zoom and pan with mouse/touch
  - Filter by jurisdiction region (toggle buttons above the graph)
  - Filter by relationship type (toggle buttons)
  - Search: type a regulation name to center the graph on that node

**Page:** `/graph` — public page accessible from main navigation

**Responsive behavior:**
- Desktop (>1024px): Full interactive graph with hover tooltips and side panel
- Tablet (640-1024px): Simplified graph, tap for details, no side panel (use modal instead)
- Mobile (<640px): Replace the force graph with a structured list view showing regulations as expandable cards, each listing its connections. Force-directed graphs are unusable on small screens.

**Navigation update:** Add "Dependency Graph" or simply "Graph" to the main navigation between Feed and Audit.

### Step 4.9 — Vercel Cron Configuration Update

Update `vercel.json` to include the embedding generation job:

```json
{
  "crons": [
    {
      "path": "/api/ingest",
      "schedule": "0 6 * * 1"
    },
    {
      "path": "/api/digest",
      "schedule": "0 7 * * 1"
    },
    {
      "path": "/api/posture/snapshot",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/embeddings/generate",
      "schedule": "0 9 * * 1"
    }
  ]
}
```

- Embeddings: Monday 9:00 AM UTC (after ingestion completes, re-embed any new or updated regulations)

### Step 4.10 — Navigation and Routing Update

Update the app navigation to include all Phase 4 pages:

**Main navigation order:**
1. Feed — public regulatory feed
2. Graph — regulation dependency graph (public)
3. Audit — configuration auditor (public)
4. Policies — policy document generator (auth-gated, show "Sign In" if unauthenticated)
5. Dashboard — personalized compliance dashboard (auth-gated, show "Sign In" if unauthenticated)

**Mobile navigation:** Hamburger menu with all five links plus sign-in/sign-out. The chat widget icon should remain visible and accessible even when the mobile menu is open.

---

## ✅ PHASE GATE 4: Intelligent Features + UI Overhaul

**Stop here. Verify ALL of the following before declaring the build complete:**

### RAG Chatbot
- [ ] pgvector extension enabled in Supabase
- [ ] Embedding pipeline generates vectors for all regulations and their chunks
- [ ] `match_regulations` RPC function performs cosine similarity search correctly
- [ ] Chat API route retrieves relevant context and generates grounded responses via Gemini
- [ ] Streaming response — tokens appear as they generate, not after full completion
- [ ] Citations link to real regulations in the database (zero hallucinated citations)
- [ ] Chat widget appears as a floating button on every page (authenticated users only)
- [ ] Widget expands to a functional chat panel with message history
- [ ] Suggested starter questions appear on empty state
- [ ] Conversation persistence — messages survive page navigation within a session
- [ ] Mobile: chat widget expands to full-screen sheet
- [ ] "This regulation is not in our database" response when asked about uncovered topics

### Policy Document Generator
- [ ] Policy generation wizard: select regulation(s), policy type, industry, optional org details
- [ ] Gemini generates a structured Markdown policy document (1500-3000 words)
- [ ] Split-pane editor: raw Markdown on left, live rendered preview on right
- [ ] "Copy Markdown" copies the raw Markdown to clipboard
- [ ] "Save to My Policies" stores the document in Supabase
- [ ] My Policies list shows saved documents with title, type, status, and last updated
- [ ] Saved policies can be opened, edited, and re-saved
- [ ] Policy status workflow: draft → review → approved → archived
- [ ] Every policy statement cites its source regulation and specific requirement
- [ ] Placeholder brackets [LIKE THIS] for organization-specific details

### UI Refresh
- [ ] `design-system/MASTER.md` generated and applied consistently
- [ ] Landing page redesigned — professional, distinctive, not generic AI aesthetic
- [ ] Feed page: RegulationCard refresh, improved filter bar
- [ ] Audit page: results display refresh, PDF download button placement
- [ ] Dashboard: gauge, cards, chart, and alerts visual refresh
- [ ] Auth pages: sign-in/sign-up redesigned
- [ ] Navigation updated with Policies and Graph links
- [ ] Global: updated color variables, typography, spacing scale
- [ ] Loading skeletons on all async content
- [ ] All pages maintain responsive design from Phase 3 (mobile/tablet/desktop)

### PDF Export
- [ ] "Download PDF" button on audit results page
- [ ] PDF includes: cover page, executive summary, jurisdiction breakdown, detailed findings, recommendations
- [ ] PDF is professionally formatted with branding and timestamps
- [ ] PDF includes data freshness timestamp
- [ ] Finding citations in PDF include regulation names and source URLs
- [ ] Cost analysis section included in PDF

### Data Expansion
- [ ] Database expanded from 12 to 50-80+ regulations
- [ ] All new regulations have verified source URLs
- [ ] All new regulations have populated `key_requirements` and `compliance_implications`
- [ ] Embedding pipeline has generated vectors for all new regulations
- [ ] RAG chatbot can answer questions about newly added regulations
- [ ] Feed page displays all new regulations correctly with proper badges
- [ ] World map reflects new jurisdictions if any were added
- [ ] No hallucinated or fabricated regulation data

### Regulation Dependency Graph
- [ ] `regulation_relationships` table seeded with 30-50 real relationships
- [ ] D3.js force-directed graph renders on `/graph`
- [ ] Nodes colored by jurisdiction region, sized by connection count
- [ ] Edges colored and styled by relationship type
- [ ] Hover highlights connected nodes and dims others
- [ ] Click opens detail panel with regulation info and connections
- [ ] Jurisdiction filter toggles work
- [ ] Relationship type filter toggles work
- [ ] Search centers graph on matching regulation
- [ ] Mobile: list view replacement for the force graph
- [ ] Navigation includes "Graph" link

### Data Integrity
- [ ] RLS enforced: users cannot see each other's chat sessions, policy documents
- [ ] Embedding generation endpoint protected by CRON_SECRET
- [ ] Chat API validates user authentication before allowing conversations
- [ ] Policy documents are user-scoped (RLS enforced)
- [ ] All cron endpoints protected by CRON_SECRET
- [ ] Zero hallucinated citations across chatbot, policy generator, and all existing features

### Deployment Readiness
- [ ] `vercel.json` includes all four cron jobs (ingest, digest, posture, embeddings)
- [ ] All new environment variables documented in `.env.example`
- [ ] Supabase migration 004 applied successfully
- [ ] `npm run build` completes without errors
- [ ] App deploys to Vercel successfully
- [ ] README.md updated with Phase 4 architecture, new features, and setup instructions

**Report status on each item. List any items that FAIL with the specific issue and proposed fix.**

---

## Quality Bars (Carried Forward + New)

1. **No mock data in production**: All chatbot answers are grounded in real regulatory data. All policy documents are generated from real regulations. All embeddings are computed from real content.
2. **No hallucinated citations**: Carries forward from all phases. The chatbot must never cite a regulation not in the database. The policy generator must only reference regulations the user selected. The dependency graph must only show real regulatory relationships.
3. **Timestamps everywhere**: Chat messages timestamped. Policy documents show generation date and version. PDF reports show generation date and data freshness. Embeddings show generation date.
4. **Graceful degradation**: If Gemini is unavailable, the chat widget shows "AI assistant temporarily unavailable" with a retry button. Policy generator shows a clear error state. The feed, dashboard, and dependency graph continue working from cached data.
5. **Mobile-first**: Chat widget works as a full-screen sheet on mobile. Policy editor adapts to single-column on mobile. Dependency graph degrades to list view. All Phase 3 responsive standards maintained.
6. **Performance**: Chat responses begin streaming within 2 seconds. Embedding search returns results in under 500ms. Dependency graph renders within 1 second for 80+ nodes. PDF generation completes within 5 seconds.
7. **Design consistency**: Every new and updated component follows the `design-system/MASTER.md` specifications. No page should look like it belongs to a different application.

---

## Expected Output

At Phase Gate 4, produce the same structured status report format used in Phases 1-3, covering every acceptance criterion above. Then produce a final deployment checklist:

```
## Deployment Checklist
- [ ] All environment variables documented in .env.example
- [ ] Supabase migrations applied in order (001, 002, 003, 004)
- [ ] pgvector extension enabled in Supabase
- [ ] Seed data loaded with 50-80+ real regulations
- [ ] Embedding pipeline run successfully (all regulations embedded)
- [ ] Regulation relationships seeded (30-50 entries)
- [ ] Vercel project connected to GitHub repo
- [ ] Vercel environment variables set (including any new ones)
- [ ] Vercel Cron jobs configured (ingest, digest, posture, embeddings)
- [ ] CRON_SECRET set and verified for all protected endpoints
- [ ] Production build succeeds (next build)
- [ ] All six Phase 4 features functional on deployed URL
- [ ] RAG chatbot answers grounded in database (manual test: 5 questions)
- [ ] Policy generator produces cited policies (manual test: 2 policy types)
- [ ] PDF export downloads correctly formatted report
- [ ] Dependency graph renders and is interactive
- [ ] Design system applied consistently across all pages
- [ ] Responsive design verified on mobile, tablet, desktop
- [ ] README.md documents: setup, architecture, all features, and deployment
```

---

**IMPORTANT: Begin with Step 4.1 (Database Schema). Then proceed to Step 4.2 (Embedding Pipeline) and Step 4.3 (RAG Chatbot) as a unit — the embedding pipeline must work before the chatbot can be tested. Do not skip ahead. Report progress at each major milestone.**
