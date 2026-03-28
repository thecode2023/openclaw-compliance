# OpenClaw Compliance Intelligence System

Real-time AI regulatory intelligence platform that tracks global AI legislation, audits agent configurations against live regulations, and delivers personalized compliance posture monitoring.

## Architecture

```
                         +------------------+
                         |   Vercel (Edge)  |
                         |   Next.js 15     |
                         +--------+---------+
                                  |
            +---------------------+---------------------+
            |                     |                     |
   +--------v--------+  +--------v--------+  +---------v--------+
   | Dashboard/Feed  |  | API Routes      |  | Cron Jobs        |
   | (React 19, SSR) |  | (Auth, Audit,   |  | (Ingest, Digest, |
   | Recharts, Maps  |  |  Profile, Seed) |  |  Posture)        |
   +--------+--------+  +--------+--------+  +---------+--------+
            |                     |                     |
            +---------------------+---------------------+
                                  |
                    +-------------v--------------+
                    |   Supabase (PostgreSQL)    |
                    |   Auth + RLS + Realtime    |
                    +-------------+--------------+
                                  |
                    +-------------v--------------+
                    |   Gemini 2.5 Flash API    |
                    |   Classification, Audit,  |
                    |   Digest Synthesis        |
                    +----------------------------+
```

## Tech Stack

| Technology | Purpose |
|---|---|
| **Next.js 15** (App Router) | Full-stack framework with SSR, API routes, and edge middleware |
| **React 19** | UI with server components for data fetching, client components for interactivity |
| **Supabase** | PostgreSQL database, auth (email/OAuth), Row Level Security, service role for cron |
| **Gemini 2.5 Flash** | AI classification of regulatory feeds, config auditing, digest synthesis |
| **Tailwind CSS + shadcn/ui** | Design system with dark theme, consistent component library |
| **Recharts** | Compliance trend charts, cost analysis bar charts |
| **react-simple-maps** | Interactive world map with real TopoJSON country boundaries |
| **Zod** | Runtime schema validation |

## Features

### Layer 1: Regulatory Feed
- RSS ingestion pipeline with AI-powered classification (Gemini)
- 50+ real regulations across 20+ jurisdictions
- Sortable/filterable data table with inline row expansion
- Card and table view toggle
- Regulatory velocity scoring per jurisdiction (0-100)

### Layer 2: Configuration Auditor
- Paste any OpenClaw agent config (JSON) for compliance audit
- Every finding grounded in real regulations (zero hallucinated citations)
- 5 industry-specific example configs (Healthcare, FinTech, HR, Support, Moderation)
- Cost analysis tab with penalty exposure, remediation estimates, ROI calculation
- Per-jurisdiction breakdown with Recharts visualization

### Layer 3: Dashboard Intelligence
- **Compliance posture gauge** (0-100) with daily snapshots and trend chart
- **Interactive world map** (react-simple-maps) with velocity-colored country fills, pulse animations on recent updates, hover tooltips, click-to-filter navigation
- **Jurisdiction command center** — 3-column kanban (Active Compliance / Monitoring / Expansion Targets) with category management via action menus
- **Weekly digest** — Gemini-synthesized executive briefing of regulatory changes
- **Alert system** — auto-generated when ingestion detects changes in tracked jurisdictions, with severity badges, mark-as-read, and dismiss
- **Cost exposure tracking** — aggregate maximum penalty exposure across tracked jurisdictions
- **Profile editor** — slide-out sheet for editing industry, jurisdictions, AI use cases
- **Quick stats pills** — enacted count, proposed count, monthly updates, next deadline, max exposure

## Database Schema

| Table | Purpose | Key Columns |
|---|---|---|
| `regulations` | AI regulations from global jurisdictions | title, jurisdiction, status, category, key_requirements (JSONB), compliance_implications (JSONB), effective_date, source_url |
| `regulatory_updates` | Changes/amendments to regulations | regulation_id (FK), update_type, title, summary, detected_at, verified |
| `ingestion_logs` | Pipeline observability | run_id, source_name, status, items_processed/created/updated |
| `audit_reports` | Config audit results | config_hash, overall_risk_score, risk_level, findings (JSONB), regulations_checked |
| `user_profiles` | User settings and onboarding | industry, jurisdictions (TEXT[]), ai_use_cases (TEXT[]), jurisdiction_priorities (JSONB) |
| `compliance_alerts` | Regulatory change notifications | user_id (FK), regulation_id (FK), alert_type, severity, read, dismissed |
| `posture_snapshots` | Daily compliance scores | user_id (FK), overall_score, jurisdiction_scores (JSONB), snapshot_date |
| `weekly_digests` | AI-generated executive briefings | user_id (FK), digest_content (JSONB), period_start, period_end |

All user-facing tables have **Row Level Security** — users can only access their own data. Service role is used for cron jobs.

## API Routes

| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/ingest` | POST/GET | CRON_SECRET | RSS feed ingestion + AI classification + alert generation |
| `/api/digest` | POST | CRON_SECRET or `?test=true` | Weekly digest generation (all users or test for current user) |
| `/api/digest` | GET | Session | Get current user's latest digest |
| `/api/posture/snapshot` | POST | CRON_SECRET | Generate daily compliance posture snapshots |
| `/api/audit` | POST | None | Run compliance audit on agent config JSON |
| `/api/regulations` | GET | None | Paginated regulation search with filters |
| `/api/user/profile` | GET/POST/PUT | Session | User profile CRUD |
| `/api/user/alerts` | GET/PATCH | Session | Fetch and update compliance alerts |
| `/api/user/posture` | GET | Session | Fetch posture snapshots |
| `/api/seed` | POST | CRON_SECRET | Seed database with regulatory data |

## Deployment

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=       # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anonymous key
SUPABASE_SERVICE_ROLE_KEY=      # Supabase service role key (server-side only)
GEMINI_API_KEY=                 # Google Gemini API key
CRON_SECRET=                    # Secret for authenticating cron job endpoints
```

### Supabase Setup

1. Create a Supabase project
2. Run migrations in order: `001_regulatory_data.sql`, `002_audit_history.sql`, `003_user_profiles.sql`, `004_jurisdiction_priorities.sql`
3. Enable email auth in Supabase dashboard
4. Copy project URL, anon key, and service role key to env vars

### Vercel Deployment

1. Connect GitHub repo to Vercel
2. Set all environment variables
3. Deploy — cron jobs configured in `vercel.json`:
   - Ingestion: Monday 6:00 AM UTC
   - Digest: Monday 7:00 AM UTC
   - Posture snapshot: Daily 8:00 AM UTC
4. Seed the database: `curl -X POST https://your-app.vercel.app/api/seed -H "x-cron-secret: YOUR_SECRET"`

## Design Decisions

### Grounding Constraint (Zero Hallucinated Citations)
Every audit finding must reference a regulation that exists in the database. After Gemini generates findings, we validate each `regulation_id` against the actual `regulations` table and strip any finding that references a non-existent regulation. This ensures a compliance officer can trust every citation.

### Regulatory Velocity Scoring
A 0-100 composite score per jurisdiction measuring regulatory momentum:
- **Regulation count** (20% weight) — more regulations = higher velocity
- **Recent updates** in last 90 days (30%) — activity matters most
- **Enacted/in-effect ratio** (25%) — active enforcement increases urgency
- **Enforcement actions** exist (25%) — binary signal for active enforcement

Cached in-memory for 1 hour to avoid recalculation on every page load.

### Cost Estimation Approach
Real penalty data from each jurisdiction's legislation:
- Fixed fines (e.g., EU AI Act: EUR 35M) and percentage-based (e.g., 7% of global turnover)
- Remediation estimates by finding severity: Critical $15K, High $10K, Medium $5K, Low $1K
- ROI calculation: "Spend $X to avoid $Y in potential penalties"
- Optional revenue input for precise percentage-based calculations

### Jurisdiction Categorization System
Three-tier priority system stored as JSONB in user_profiles:
- **Active Compliance** — jurisdictions where the user actively operates
- **Monitoring** — jurisdictions being watched but not yet operating in
- **Expansion Targets** — jurisdictions planned for future entry

Each jurisdiction can be moved between categories via the dashboard command center, persisted via API.

## Screenshots

> Screenshots available at `/docs/screenshots/` (placeholder)
