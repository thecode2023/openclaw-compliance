# Phase 4.99: Product Polish & UX Intelligence — Pre-Deployment Sprint

---

## Philosophy

Phase 4 built the features. Phase 4.99 makes them feel like a product. Every change in this sprint answers one question: "Why would a compliance officer open this tool instead of their email on Monday morning?"

The answer: because Complyze tells them what to do today, makes their work faster, and makes them look good to their boss.

---

## 4.99.1 — Context-Aware Chatbot

### Problem
The chatbot shows the same four starter questions on every page. It doesn't know what the user is looking at, so every conversation starts from zero.

### Solution
The chatbot adapts its suggestions and context based on the current page and what the user is viewing.

### Implementation

**A. Page-aware starter questions**

Pass a `pageContext` prop to `<ChatWidget />` from each page layout. The context includes:
- `page`: which page the user is on (feed, audit, dashboard, policies, graph)
- `entity`: what specific item they're viewing (regulation ID, audit report ID, policy ID)
- `entityTitle`: display name of what they're viewing

Each page passes its context:
```
/ (landing)        → { page: 'home' }
/feed              → { page: 'feed' }
/feed?reg=uuid     → { page: 'feed', entity: 'reg-uuid', entityTitle: 'EU AI Act' }
/audit             → { page: 'audit' }
/audit (results)   → { page: 'audit-results', entity: 'report-uuid' }
/dashboard         → { page: 'dashboard' }
/policies          → { page: 'policies' }
/policies (editor) → { page: 'policy-editor', entity: 'policy-uuid', entityTitle: 'AI Risk Mgmt Policy' }
/graph             → { page: 'graph' }
```

**B. Dynamic starter questions per page**

```typescript
const CONTEXTUAL_STARTERS: Record<string, string[]> = {
  home: [
    "What regulations should I track for my industry?",
    "Give me a quick overview of the EU AI Act",
    "What are the biggest compliance deadlines coming up?",
    "How does Complyze help with AI compliance?"
  ],
  feed: [
    "What changed in AI regulation this week?",
    "Which regulations have the strictest penalties?",
    "Compare EU and US approaches to AI regulation",
    "Which regulations apply to financial services?"
  ],
  'feed-detail': [
    "Summarize the key requirements of {entityTitle}",
    "What are the penalties under {entityTitle}?",
    "Which other regulations interact with {entityTitle}?",
    "Generate a compliance checklist for {entityTitle}"
  ],
  'audit-results': [
    "Explain the critical findings in this audit",
    "How do I fix the highest-severity issues?",
    "What's my total penalty exposure from these findings?",
    "Which jurisdiction has the most compliance gaps?"
  ],
  dashboard: [
    "What should I focus on today?",
    "Which jurisdictions need the most attention?",
    "How has my compliance posture changed this month?",
    "What upcoming deadlines should I prepare for?"
  ],
  policies: [
    "How do my saved policies align with current regulations?",
    "What policy gaps do I have?",
    "What's missing from my most recent policy?",
    "Which regulations don't have associated policies yet?"
  ],
  'policy-editor': [
    "What's missing from this policy?",
    "Does {entityTitle} cover all applicable regulations?",
    "Suggest improvements for this policy's implementation section",
    "What regulations should this policy also reference?"
  ],
  graph: [
    "Which regulation has the most dependencies?",
    "What regulations does the EU AI Act trigger?",
    "Are there any conflicting regulations I should know about?",
    "Explain how GDPR and the EU AI Act interact"
  ]
}
```

**C. Auto-inject page context into chat messages**

When a user sends a message from a specific page, the chat API silently prepends context:
```
[User is currently viewing: EU AI Act on the regulation feed page]
```
This helps the RAG system give more relevant answers without the user having to specify.

**D. "Ask about this" inline buttons**

On the feed page, each RegulationCard gets a small chat icon button. Clicking it opens the chatbot pre-filled with "Tell me about {regulation title}". Same for audit findings — each FindingCard gets an "Explain this" button that opens the chatbot with the finding context.

### Files to modify
- `src/components/chat/ChatWidget.tsx` — accept pageContext prop, render dynamic starters
- `src/app/layout.tsx` — pass default context
- `src/app/feed/page.tsx` — pass feed context
- `src/app/audit/page.tsx` — pass audit context  
- `src/app/dashboard/page.tsx` — pass dashboard context
- `src/app/policies/page.tsx` — pass policies context
- `src/app/api/chat/route.ts` — accept and use pageContext in RAG prompt
- `src/components/feed/RegulationCard.tsx` — add "Ask about this" button
- `src/components/audit/FindingCard.tsx` — add "Explain this" button

---

## 4.99.2 — Share & Export Chat Answers

### Problem
Compliance officers constantly forward regulatory analysis to their team, legal counsel, or management. Right now they'd have to screenshot or manually copy chatbot answers.

### Solution
One-click share button on every assistant message that copies a cleanly formatted answer with citations.

### Implementation

**A. Copy button on each assistant message**

Add a small "Copy" icon button (clipboard icon from lucide-react) that appears on hover over each assistant message. Clicking it copies the message content as formatted text:

```
--- Complyze AI Analysis ---

[The full message text with citations preserved]

Sources:
- EU AI Act (Regulation 2024/1689) — European Union
- GDPR Article 22 — European Union

Generated by Complyze — complyze.dev
[Date]
```

**B. "Share as email" option**

A secondary action that opens the user's email client with a pre-formatted email:
- Subject: "Complyze Analysis: [first 50 chars of the question]"
- Body: the formatted answer with sources

Use `mailto:` link with encoded body — no backend needed.

**C. Export conversation as PDF**

A "Download conversation" button in the chat header that exports the entire conversation as a simple PDF using the existing jsPDF infrastructure. Format: question/answer pairs with timestamps and citations.

### Files to modify
- `src/components/chat/ChatWidget.tsx` — add copy/share/export buttons
- `src/lib/utils/chat-export.ts` (new) — format chat for clipboard, email, PDF

---

## 4.99.3 — Chat History Sidebar

### Problem
Conversations persist in Supabase but there's no way to browse or revisit past conversations. Users lose access to valuable analysis they've already done.

### Solution
A small sidebar panel in the chat widget showing past conversation sessions.

### Implementation

**A. History toggle in chat header**

Add a clock/history icon button in the chat widget header between "New conversation" and "Close". Clicking it slides in a panel showing:
- List of past chat sessions, newest first
- Each entry shows: session title (auto-generated from first message), date, message count
- Click a session to load it into the chat view
- Currently active session is highlighted
- "New conversation" button at the top of the history list

**B. Session data loading**

When a user clicks a past session:
1. Fetch all messages for that session from `chat_messages` table
2. Load them into the chat view
3. Set the active session ID so new messages append to this conversation
4. User can continue the conversation where they left off

**C. Delete session**

Swipe-to-delete on mobile, X button on hover for desktop. Deletes the session and all its messages from Supabase.

**D. Search past conversations**

A small search input at the top of the history panel that filters sessions by title. For a user who's had 20+ conversations, this is essential.

### Files to modify
- `src/components/chat/ChatWidget.tsx` — add history panel, toggle, session switching
- `src/components/chat/ChatHistory.tsx` (new) — history list component
- `src/hooks/useChat.ts` — add loadSession(), deleteSession(), listSessions()
- `src/app/api/chat/sessions/route.ts` (new) — GET (list sessions), DELETE (remove session)

---

## 4.99.4 — "What Should I Do Today?" Dashboard Section

### Problem
The dashboard shows data — scores, charts, alerts — but doesn't tell the user what action to take. A compliance officer opens it and thinks "ok, but what do I do?"

### Solution
A priority-ranked action list at the top of the dashboard that tells the user exactly what needs attention today.

### Implementation

**A. Action item engine (`src/lib/utils/action-items.ts`)**

A function that queries the user's data and generates prioritized action items:

```typescript
interface ActionItem {
  id: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  icon: string;           // lucide icon name
  title: string;          // "Review 3 unread critical alerts"
  description: string;    // "New enforcement actions detected in EU, US-CA"
  action_url: string;     // where to go to take action
  action_label: string;   // "Review Alerts"
  category: 'deadline' | 'alert' | 'policy' | 'score' | 'digest';
}
```

**B. Action item sources (priority order):**

1. **Upcoming regulatory deadlines** (urgent)
   - Query regulations where `effective_date` is within the next 90 days and user tracks that jurisdiction
   - "EU AI Act Article 73 takes effect in 120 days — review your compliance readiness"
   - Link to: the regulation in the feed

2. **Unread critical/high alerts** (urgent)
   - Query `compliance_alerts` where `read = false` and `severity IN ('critical', 'high')`
   - "3 critical alerts require your attention"
   - Link to: dashboard alerts section

3. **Policies needing review** (high)
   - Query `policy_documents` where `status = 'draft'` and `updated_at` is older than 7 days
   - "2 draft policies haven't been reviewed — move them to review or approve"
   - Link to: /policies

4. **Policy coverage gaps** (high)
   - Compare user's tracked jurisdictions against policies that exist
   - "You're tracking 8 jurisdictions but only have policies covering 3"
   - Link to: /policies (generate tab)

5. **Compliance score drops** (medium)
   - Compare latest `posture_snapshot` to the one before it
   - "Your EU compliance score dropped 8 points this week"
   - Link to: dashboard jurisdiction section

6. **Unread weekly digest** (medium)
   - Query `weekly_digests` where `read = false`
   - "Your weekly regulatory briefing is ready"
   - Link to: dashboard digest section

7. **Stale audit** (low)
   - If the user hasn't run an audit in 30+ days
   - "It's been 32 days since your last compliance audit — regulations may have changed"
   - Link to: /audit

**C. Dashboard UI**

Display as the FIRST section on the dashboard, above everything else:
- Section title: "Action Items" with a count badge
- Expandable cards sorted by priority
- Each card has: priority indicator (colored left border), icon, title, description, action button
- "All clear" state when no actions needed: "You're up to date. Next digest arrives Monday."
- Collapsible after first visit (remember collapse state in localStorage or user prefs)

### Files to create/modify
- `src/lib/utils/action-items.ts` (new) — action item generation engine
- `src/components/dashboard/ActionItems.tsx` (new) — action items UI component
- `src/app/dashboard/page.tsx` — add ActionItems as first section

---

## 4.99.5 — Compliance Deadline Countdown

### Problem
The most powerful motivator in compliance is a deadline. The EU AI Act Article 73 deadline (August 2, 2026) is the forcing function for the entire market. But the dashboard doesn't surface deadlines at all.

### Solution
A deadline countdown section on the dashboard showing upcoming regulatory effective dates with readiness indicators.

### Implementation

**A. Deadline data source**

Query `regulations` table where:
- `effective_date` is in the future (or within the last 30 days for recently-effective regulations)
- The regulation's jurisdiction overlaps with the user's tracked jurisdictions
- Order by `effective_date` ascending (soonest first)

**B. Readiness score calculation**

For each upcoming deadline, calculate a readiness percentage based on:
- Does the user have a policy covering this regulation? (+30%)
- Has the user run an audit that includes this jurisdiction? (+25%)
- Are there open critical/high findings for this jurisdiction? (-20%)
- Does the user have the regulation in their tracked jurisdictions? (+15%)
- Has the user read the weekly digest mentioning this regulation? (+10%)

This is a heuristic, not a precise measurement — but it gives users something to act on.

**C. Dashboard UI**

Display as a horizontal scrollable row of deadline cards, or a compact list:

Each card shows:
- Regulation name (truncated)
- Jurisdiction badge
- Days remaining (large number, color-coded: red <30, amber 30-90, green >90)
- "Effective: [date]"
- Readiness progress bar (0-100%)
- Click navigates to the regulation in the feed

For recently-effective regulations (past 30 days), show as "NOW IN EFFECT" with a different style.

### Files to create/modify
- `src/lib/utils/deadlines.ts` (new) — deadline query and readiness calculation
- `src/components/dashboard/DeadlineCountdown.tsx` (new) — countdown UI
- `src/app/dashboard/page.tsx` — add DeadlineCountdown section

---

## 4.99.6 — One-Click "Track This Regulation" on Feed

### Problem
To track a regulation, users must go through onboarding and select jurisdictions. They can't just see a regulation in the feed and say "I want to follow this one."

### Solution
A "Track" button on each regulation card in the feed that adds the regulation's jurisdiction to the user's profile.

### Implementation

**A. Track button on RegulationCard**

If the user is authenticated, show a small bookmark/track icon button on each RegulationCard:
- **Untracked state**: Outline bookmark icon, tooltip "Track this jurisdiction"
- **Tracked state**: Filled bookmark icon (indigo), tooltip "Tracking"
- Clicking toggles the jurisdiction in/out of the user's `user_profiles.jurisdictions` array

**B. API route**

`PATCH /api/user/profile/jurisdictions`
- Accepts `{ jurisdiction: string, action: 'add' | 'remove' }`
- Updates the user's `jurisdictions` array in `user_profiles`
- Returns the updated jurisdictions list

**C. Optimistic UI**

Toggle the icon immediately on click, revert if the API call fails. No page reload needed.

**D. Unauthenticated state**

For anonymous users, the track button shows a tooltip: "Sign in to track regulations" and clicking redirects to `/auth/signin`.

### Files to create/modify
- `src/components/feed/RegulationCard.tsx` — add track button
- `src/app/api/user/profile/jurisdictions/route.ts` (new) — PATCH endpoint
- `src/hooks/useTrackRegulation.ts` (new) — optimistic toggle hook

---

## 4.99.7 — "What's New This Week" Feed Banner

### Problem
The feed is a static list. Users have to scroll through 74 regulations to find what changed recently. There's no visual distinction between a regulation that was updated yesterday and one that hasn't changed in a year.

### Solution
A highlighted banner at the top of the feed showing regulations with recent activity.

### Implementation

**A. Recent activity query**

Query `regulatory_updates` from the last 7 days, joined with `regulations` to get titles and jurisdictions. Also query `regulations` where `updated_at` is within the last 7 days.

**B. Banner UI**

At the top of the feed page, above the filter bar:
- Section title: "Updated This Week" with a pulse indicator
- Horizontal scrollable row of compact cards (or a collapsible section)
- Each card shows: regulation title, jurisdiction badge, update type badge (amendment/enforcement/new), date
- Click navigates to the regulation detail
- If nothing changed this week: "No regulatory changes this week. Next scan: Monday 6AM UTC."
- Dismissible (X button), remembers dismiss state until next week

**C. Visual distinction in the main feed**

Regulations that have updates in the last 7 days get a subtle indicator in the main feed list too — a small "Updated" badge or a colored left border on their card.

### Files to create/modify
- `src/components/feed/WeeklyUpdatesBanner.tsx` (new) — banner component
- `src/app/feed/page.tsx` — add banner above filters, pass recent updates data
- `src/components/feed/RegulationCard.tsx` — add "recently updated" indicator

---

## 4.99.8 — Policy Coverage Dashboard

### Problem
Users generate policies one at a time but have no visibility into their overall coverage. They don't know which regulations have policies and which don't.

### Solution
A coverage matrix showing policy coverage gaps, accessible from both the dashboard and the policies page.

### Implementation

**A. Coverage calculation (`src/lib/utils/policy-coverage.ts`)**

```typescript
interface CoverageItem {
  regulation_id: string;
  regulation_title: string;
  jurisdiction: string;
  jurisdiction_display: string;
  has_policy: boolean;
  policy_count: number;
  policy_statuses: string[];  // ['draft', 'approved']
  latest_policy_date: string | null;
}

interface CoverageReport {
  total_tracked_regulations: number;
  covered_regulations: number;
  coverage_percentage: number;
  gaps: CoverageItem[];        // regulations without policies
  covered: CoverageItem[];     // regulations with policies
}
```

For each regulation in the user's tracked jurisdictions:
- Check if any `policy_documents` exist where `regulation_id` matches
- Also check `policy_documents.metadata` for regulation references in generated content
- Classify as covered (has at least one policy) or gap (no policy)

**B. Dashboard widget**

A compact card on the dashboard:
- "Policy Coverage: 38%" with a progress ring
- "12 of 32 tracked regulations have associated policies"
- "Top gaps: EU AI Act, DORA, CCPA" (clickable, links to policy generator pre-filled)
- "Generate Missing Policies" button

**C. Policies page coverage tab**

Add a third tab to the policies page: "Generate | My Policies | Coverage"

Coverage tab shows:
- Overall coverage percentage with visual bar
- Grid/list of all tracked regulations, each showing:
  - Regulation name + jurisdiction
  - Coverage status: ✅ Covered (with policy title link) or ❌ Gap
  - If covered: policy status badge (draft/review/approved)
  - If gap: "Generate Policy" button (pre-fills the generator with that regulation)
- Filterable by: covered/gaps only, jurisdiction, category
- Sortable by: regulation name, jurisdiction, coverage status

**D. Gap alerts**

When the coverage calculation runs, if coverage drops below 50%, add it to the action items (4.99.4).

### Files to create/modify
- `src/lib/utils/policy-coverage.ts` (new) — coverage calculation
- `src/components/dashboard/PolicyCoverage.tsx` (new) — dashboard widget
- `src/components/policies/CoverageTab.tsx` (new) — full coverage view
- `src/app/policies/PoliciesClient.tsx` — add Coverage tab

---

## 4.99.9 — Companion Document Generation

### Problem
A policy document alone doesn't complete the compliance workflow. Teams also need training materials, implementation checklists, and executive summaries derived from the same regulatory requirements.

### Solution
After generating a policy, offer one-click generation of companion documents from the same regulatory data.

### Implementation

**A. Companion document types**

Three companion formats, each with its own Gemini prompt:

1. **Implementation Checklist**
   - A task-by-task checklist derived from the policy's implementation requirements
   - Each item has: task description, responsible role, estimated effort, regulatory reference
   - Format: Markdown checklist with `- [ ]` syntax
   - Target length: 500-1000 words

2. **Executive Briefing**
   - A 1-page summary of the policy for C-suite/board consumption
   - Covers: why this policy exists, what it requires, key deadlines, penalty exposure, resource implications
   - Written for a non-technical executive audience
   - Target length: 300-500 words

3. **Training Outline**
   - A structured training session plan for employees affected by the policy
   - Sections: learning objectives, key concepts, regulatory context, practical scenarios, quiz questions, resources
   - Target length: 800-1500 words

**B. UI integration**

After a policy is generated or when viewing a saved policy in the editor:
- A "Generate Companion Documents" dropdown/section below the editor toolbar
- Three buttons: "Implementation Checklist", "Executive Briefing", "Training Outline"
- Each generates in a modal or new tab, using the same regulation data + the policy content as additional context
- Generated companions can be copied, downloaded as PDF, or saved alongside the policy

**C. API route**

`POST /api/policies/companion`
- Accepts: `{ policy_id, companion_type, regulation_ids }`
- Fetches the policy content + regulation data
- Calls Gemini with the appropriate companion prompt
- Returns generated Markdown

**D. Storage**

Store companions in the `policy_documents` table with a `metadata.companion_of` field pointing to the parent policy ID and a `metadata.companion_type` field. They appear grouped under the parent policy in the "My Policies" tab.

### Files to create/modify
- `src/lib/ai/prompts/companion-checklist.ts` (new)
- `src/lib/ai/prompts/companion-briefing.ts` (new)
- `src/lib/ai/prompts/companion-training.ts` (new)
- `src/app/api/policies/companion/route.ts` (new)
- `src/app/policies/PoliciesClient.tsx` — add companion generation buttons
- `src/components/policies/CompanionGenerator.tsx` (new) — companion UI

---

## 4.99.10 — Smart Onboarding (First-Time User Experience)

### Problem
First-time users land on a generic dashboard after onboarding. They've selected jurisdictions and industry but don't know where to start. Time-to-value is too long.

### Solution
An intelligent first-session experience that routes users to the most relevant feature immediately and demonstrates value in under 60 seconds.

### Implementation

**A. Post-onboarding routing**

After the onboarding wizard completes (user selects industry, jurisdictions, use cases), instead of redirecting straight to the empty dashboard:

1. Show a "Your Compliance Quick Start" interstitial page
2. Based on their selections, calculate and display:
   - "You're tracking N jurisdictions with M applicable regulations"
   - "X of these regulations are currently enacted with enforcement deadlines"
   - "Your estimated total penalty exposure: $Y.YM" (from cost estimator data)
3. Offer three clear paths:

   **Path A — "See my biggest risks"** → Runs a pre-configured audit with the example config closest to their industry. Lands on audit results page showing real findings. Immediate value.

   **Path B — "Generate my first policy"** → Routes to the policy generator pre-filled with their industry and the top 3 regulations for their jurisdictions. One click to generate. Immediate value.

   **Path C — "Explore my dashboard"** → Standard dashboard redirect. For users who want to browse first.

**B. First-visit dashboard nudges**

If the dashboard is "empty" (no audits run, no policies generated, no alerts), show contextual nudge cards instead of empty states:
- "Run your first audit" card with a preview of what the audit results look like
- "Generate your first policy" card showing a sample policy snippet
- "Ask the AI assistant" card with a pre-filled question

These nudge cards disappear once the user has completed the corresponding action. Track completion via `user_profiles.metadata`:
```json
{
  "onboarding_complete": true,
  "first_audit_run": false,
  "first_policy_generated": false,
  "first_chat_used": false
}
```

**C. Progressive disclosure**

Don't show all dashboard sections on first visit. Start with:
1. Action Items (will show "Run your first audit" and "Generate your first policy")
2. Jurisdiction overview (populated from their selections)
3. World map (shows their tracked jurisdictions)

The compliance trend chart, alerts feed, and digest section appear after the user has generated at least one data point (audit or posture snapshot).

### Files to create/modify
- `src/app/dashboard/quickstart/page.tsx` (new) — quick start interstitial
- `src/components/dashboard/OnboardingNudges.tsx` (new) — nudge cards
- `src/app/dashboard/page.tsx` — conditional rendering based on user activity
- `src/lib/supabase/middleware.ts` — route to quickstart on first post-onboarding visit

---

## Build Order (Recommended)

The features have dependencies. Build in this order:

| Order | Feature | Depends On | Effort |
|-------|---------|-----------|--------|
| 1 | 4.99.7 — Weekly Updates Banner | Nothing | Small |
| 2 | 4.99.6 — Track This Regulation | Nothing | Small |
| 3 | 4.99.2 — Share Chat Answers | Nothing | Small |
| 4 | 4.99.3 — Chat History | Nothing | Medium |
| 5 | 4.99.1 — Context-Aware Chatbot | Nothing | Medium |
| 6 | 4.99.5 — Deadline Countdown | Nothing | Medium |
| 7 | 4.99.4 — Action Items Dashboard | 4.99.5 (uses deadlines), 4.99.8 (uses coverage) | Medium |
| 8 | 4.99.8 — Policy Coverage | Nothing | Medium |
| 9 | 4.99.9 — Companion Documents | Policy generator working | Medium |
| 10 | 4.99.10 — Smart Onboarding | 4.99.4 (action items), 4.99.8 (coverage) | Large |

Total estimated: ~8-12 Claude Code sessions depending on complexity and debugging.

---

## Success Criteria

After Phase 4.99, a first-time user should be able to:
1. Sign up and understand their compliance landscape in under 60 seconds
2. Generate their first policy with one click from the quick start
3. See what needs attention today without scrolling
4. Track a regulation from the feed with one click
5. Ask the chatbot a question relevant to what they're looking at
6. Share an AI-generated analysis with their team in one click
7. See their policy coverage gaps and fill them
8. Know exactly how many days until their next regulatory deadline

Every one of these creates a reason to come back tomorrow.
