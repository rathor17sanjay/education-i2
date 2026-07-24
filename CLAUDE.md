# GT CampusAI — Project Context for Claude Code

> This file is auto-read by Claude Code at the start of every session in this
> project folder. It captures everything decided in prior planning discussions
> so no context needs to be re-explained. Keep it updated as the project evolves.

---

## 1. What we're building

**GT CampusAI** — a multi-tenant, AI-powered Student Engagement / Admissions
Assistant platform for Higher Education Institutions, modeled closely on
**Sharda University's "SAI"** (built by vendor WhiteBird, live at
`sharda.ac.in/sai`), which we studied in detail as the primary competitive
benchmark.

It is **not a chat widget**. It is a generative, SEO-indexable "AI answer page"
system: every user query becomes its own addressable URL
(`university.edu/ai/q/{query-slug}`) rendering a structured, branded page —
closer to "AI-generated landing pages" than a chatbot transcript.

### Product philosophy
- Acts as an **AI Admissions Counsellor**, not a generic chatbot — every
  interaction should nudge the student toward applying.
- **Never hallucinates.** Answers only from the university's own approved
  knowledge base — no open internet access for the assistant.
- **Always shows visual, structured responses** (cards, tables, comparisons),
  not walls of plain text.
- **Multi-tenant SaaS**: one shared backend, many universities, each fully
  isolated (data, branding, prompts, analytics).

### Business goals (from original PRD)
Improve website engagement, lead generation, lead quality, lead-to-application
conversion; reduce admissions counselling workload; provide 24x7 instant
responses; capture student intent data; strengthen brand perception.

---

## 2. Competitive benchmark: Sharda AI (WhiteBird / Iris Discover)

We did a deep frame-by-frame analysis of a real usage video plus multiple
screenshots. Key findings that directly inform our design:

### URL / routing architecture
Every question (typed or clicked from a suggestion chip) becomes a real,
shareable, crawlable page: `/sai/q/why%20sharda%20university`. This is the
single most important architectural pattern to replicate — it makes every
AI answer an SEO asset, not an ephemeral chat bubble.

### Page template (identical shell across every response type)
```
┌─────────────────────────────────────────────┐
│ [Logo]                    [Save Result] [⋯]  │ ← persistent header
├─────────────────────────────────────────────┤
│ H1 Title (serif, large)                      │ ← query reframed as headline
│ Subtitle/description (1-2 lines, muted)      │ ← AI-generated context line
├─────────────────────────────────────────────┤
│   [Content Block 1 — varies by data type]    │
│   [Content Block 2]                          │
│   [Content Block N...]                       │
├─────────────────────────────────────────────┤
│ [contextual follow-up chips]             [⌄] │ ← sticky
│ [ Tell me about {University}...   ➤ ] [Apply]│ ← sticky, always visible
│ "{AI} can make mistakes."  Powered by ⋅      │
└─────────────────────────────────────────────┘
```

### Visual design language (observed, to replicate)
- **Color palette — deliberately minimal**: deep navy background
  (`#1a2a38`-ish), slightly lighter navy cards, **one single amber/orange
  accent** (`#f5a623`-ish) used for every number, price, CTA, bullet dot,
  category pill, table header. Resist adding more colors.
- **Typography**: serif display font for H1/headings (premium/editorial
  feel), clean sans-serif for body text, muted gray-blue for secondary text.
- **Branded placeholder fallbacks**: missing images (e.g. faculty photos)
  render as a solid card with a large amber initial-letter avatar instead of
  a broken image icon — never let a missing asset look broken.
- **Graceful "no answer" state**: when data is missing, the AI explains
  what it does/doesn't have and redirects to official contact info — styled
  identically to a normal response block, not an error screen.
- **Fade-masked scroll edges** under the sticky header/footer (gradient
  mask) so content doesn't harshly clip.
- **Always-visible "Apply Now" CTA** docked next to the input bar on every
  single page, regardless of content — conversion is never buried.

### Observed content block types (→ our fixed component library)
| Block type | Structure |
|---|---|
| Stat grid | N-column grid, big accent-colored number + gray label |
| Side-by-side comparison cards | Paired cards, identical internal structure |
| Comparison table | Row/column table, accent-colored headers |
| Profile/person card | Avatar (or initial-letter fallback), overline label, name, title, bio |
| Description + bullet list | Heading, paragraph, bulleted list w/ accent dot markers |
| Grouped nested tables | Grouped by category (e.g. hostel name), metadata line, row items right-aligned price |
| FAQ accordion | Question + chevron, collapsed by default |

### Interaction / loading behavior (from video analysis)
- **No jarring blank screens or spinner-only states.** Header and sticky
  footer never re-render or flicker during a query transition — only the
  content region between them changes.
- **Title/H1 renders fast** (near-instant on transition), content blocks
  below **populate progressively** — implies a two-phase generation: fast
  classify+title step, then slower structured block-fill step.
- **Follow-up suggestion chips are dynamic and contextual** to the answer
  just given, not a static global set.
- Calm, "page navigation" feel rather than chatbot "typing…" theatrics.

---

## 3. Core architecture

### Multi-tenancy
- One shared backend, N tenant instances, resolved by domain/subdomain
  (`university.edu/ai` or `ai.university.edu`).
- Every table carries `tenant_id`. **Enforce isolation via Postgres Row-Level
  Security (RLS)**, not just application-layer filtering — a bug in app code
  must not be able to leak one university's data into another's response.
- Per-tenant vector namespace/filter — never optional, always enforced
  server-side at query time.

### Roles
| Role | Scope |
|---|---|
| **Superadmin** (platform team) | All tenants — create/suspend universities, cross-tenant analytics, impersonation (logged), global content library |
| **Tenant Owner** | Full control of one university |
| **Tenant Editor** | Content/FAQ/datasource management, no billing/user mgmt |
| **Tenant Viewer** | Read-only analytics/reports |

Enforce role + tenant scope at the **API layer**, never rely on frontend
hiding UI elements.

### Datasource ingestion — layered storage model
This is the core data pipeline, source-agnostic (website crawl, document
upload, or manual entry all funnel into the same layers):

1. **Raw capture** (object storage — S3/Cloudflare R2): raw HTML / uploaded
   file, path convention `{tenant_id}/raw/{source_type}/{page_hash}/{ts}`.
   Kept for audit trail and re-parsing without re-crawling.
2. **Clean/structured content** (Postgres `documents` table): parsed clean
   text + metadata. System of record. Admin approval workflow (`staged` →
   `approved` → `archived`) happens here via `status` + `content_hash` diff
   detection.
3. **Chunked + embedded** (pgvector, colocated in same Postgres): chunks
   (~300-500 tokens, overlap) with embeddings. Only layer the AI actually
   searches. Always filtered by `tenant_id`.
4. **Structured extracts** (typed Postgres tables, e.g. `programme_fees`):
   for anything with hard numbers (fees, dates, eligibility %) — pulled
   directly for accuracy rather than extracted from embedded prose. This is
   what powers reliable FeeBreakdown/ComparisonTable blocks.

### Manual content entry (FAQs, notices, structured facts)
Same `documents` table, just `source_type = 'manual_faq' | 'manual_note' |
'announcement'`. Generic `content_type` field handles FAQ / Announcement
(with expiry) / Structured fact (key-value) / Free-form note without needing
separate tables. Draft → Published gate, published = searchable.

### Retrieval / guardrails
- **No web-browsing/search tool** enabled for the student-facing assistant —
  ever. It only sees tenant-scoped retrieved content.
- System prompt: answer only from provided context; if insufficient, say so
  or escalate — never fill gaps from general knowledge.
- Retrieval query always includes `tenant_id` filter enforced server-side
  (RLS/metadata filter), not just prompted.
- Lightweight **groundedness check** post-generation before returning to
  user (claims should trace back to retrieved chunks).
- **Sensitive topics** (faculty salary, legal issues, negative news, internal
  policy, political questions) → configurable per-tenant: Ignore / Neutral /
  Escalate / Comparison. Politely decline or route to human.
- **Prompt injection protection**: treat retrieved content and user input as
  data, never as instructions; sanitize before including in context.
- **Competition guard**: admin-configurable response when competitor
  universities are mentioned.

### AI response engine → structured block output
- The LLM's job per query: (a) classify intent, (b) retrieve, (c) select a
  block type from the fixed library, (d) emit structured JSON matching that
  block's schema via tool-calling / JSON-schema-constrained output.
- Frontend renders **purely off structured JSON** — never parses free text
  into layout. If a response fails schema validation, fall back to plain
  text rather than rendering malformed UI.

### Theming / branding engine
- Per-tenant `tenant_theme` object: primary/secondary/accent color, font
  family, logo, favicon, corner-radius style, tone-of-voice.
- Delivered as **CSS custom properties** at the root; one shared component
  library reads only these variables — never hardcoded colors — so a theme
  change requires zero code changes per university.
- Superadmin-facing live-preview editor recommended (pick colors/fonts,
  see actual ProgrammeCard/chat render update in real time).

### CRM / lead capture
- Capture: name, email, phone, programme interest, conversation history,
  intent score, source, UTM, location.
- Multi-CRM adapter pattern: common internal "Lead" event schema, adapter
  module per CRM (LeadSquared, Meritto, Salesforce, HubSpot, Zoho, custom
  API) — adding a new CRM shouldn't touch core logic.
- Human handover: low confidence score OR explicit request → transfer to
  admissions team via WhatsApp/Phone/Live Chat/Email.

### SaaS-specific admin design parameters (important, easy to retrofit-cost)
- **Tenant lifecycle**: `trial → active → past_due → suspended → churned`,
  plus plan tiers with feature-flag gating (table keyed by tenant_id +
  feature_key, checked at API layer).
- **Usage metering**: `usage_events` table (tenant_id, metric_type,
  quantity, timestamp) → nightly aggregation. Tracks conversations, LLM
  tokens (cost driver, separate from conversation count), documents
  indexed, crawl volume, API calls, seats.
- **Audit log**: immutable log of every admin action (theme change, FAQ
  published, document approved, user added/removed, crawler frequency
  changed) — actor, before/after value, IP, timestamp. Non-negotiable given
  Superadmin override power across many tenants + DPDP/GDPR posture.
- **Tenant provisioning**: build as a repeatable "Create Tenant" wizard +
  "Clone tenant config" option, not manual DB inserts — you'll onboard many
  universities.
- **Crawler scheduling**: per-tenant, per-source-type frequency
  (daily/weekly/monthly/custom), Superadmin sets defaults/bounds, tenant
  admin can adjust within range. `crawler_schedule` table.

---

## 4. Decided tech stack

### Guiding principle
Same architecture at every stage — only the *implementation weight* changes
as we scale. Nothing here gets rewritten later, only re-hosted/upgraded.

### Frontend
- **Next.js (React)**, App Router, ISR for programme/fee/comparison pages.
- **Tailwind CSS** + CSS custom properties for per-tenant theming.
- Structured UI rendering via a typed component registry (ProgrammeCard,
  FeeBreakdown, ComparisonTable, FacultyCard, Carousel, FAQAccordion, etc.)
  mapped 1:1 to the AI's JSON block schema.
- Streaming via SSE/Vercel AI SDK.
- Hosting: **Vercel** (free/hobby tier to start).

### Backend / API
- **Python + FastAPI** (chosen over Node so AI orchestration, crawling, and
  document parsing all stay in one language).
- Tenant resolved from subdomain/path at request entry, attached to context;
  never trust a client-supplied tenant_id.
- Hosting (Phase 0): single **DigitalOcean Droplet** running FastAPI in
  Docker (see §5 — infra already provisioned).

### AI / RAG layer
- **LLM**: Claude (Anthropic API) — kept behind a thin custom interface for
  LLM-agnostic swappability. No heavy framework (LangChain/LlamaIndex)
  needed yet — direct SDK + tool-calling is enough control for our exact
  6-8 block types.
- **Embeddings** (Phase 0): OpenAI `text-embedding-3-small` (cheapest
  capable option). Can upgrade to Voyage AI later.
- **Vector DB** (Phase 0): **pgvector inside Supabase Postgres** — no
  separate service. Migrate to Qdrant only past ~500K+ chunks per tenant or
  if latency degrades.
- **No web-search tool** wired into the student-facing assistant, ever.

### Data layer
- **Supabase** (Postgres + pgvector + Auth + Storage + RLS, one bill) —
  Free tier to start, upgrade to Pro ($25/mo) once a second real tenant
  exists or approaching 500MB DB / 1GB storage.
- **Cache**: Upstash Redis (serverless, free tier) — also used for
  near-duplicate query caching (skip LLM call on repeat questions).
- **Object storage**: Supabase Storage (included) or Cloudflare R2 later
  for larger media libraries (no egress fee).

### Ingestion pipeline
- **Crawler**: Playwright (JS-heavy sites) + Scrapy (static).
- **Document parsing**: Unstructured.io + `pdfplumber`/`python-docx`/
  `python-pptx`/`openpyxl` for edge cases.
- **Scheduling** (Phase 0): simple cron (APScheduler) or a queue table in
  Postgres. Upgrade to **Temporal** only once ingestion workflows (crawl →
  parse → embed → stage → approve → activate, multi-step + human-in-loop)
  get complex enough that a queue table becomes hard to reason about.

### Infra / DevOps (Phase 0 — minimal cost, already provisioned, see §5)
- DigitalOcean Droplet (Singapore) running Docker + Docker Compose.
- Cloudflare (free tier) in front eventually, for CDN + DDoS protection.
- nginx + Let's Encrypt for reverse proxy/SSL — **not yet set up**, deferred
  until the API is working and ready to expose publicly.
- Auth: Supabase Auth (covers admin login; add SSO/SAML later via
  Clerk/Auth0 if an enterprise tenant requires it).

### Scale-up path (for later, don't build prematurely)
pgvector → Qdrant · single Droplet → containers/K8s (DOKS) · cron →
Temporal · Supabase → self-managed Postgres — only when real signals (data
volume, concurrent load, workflow complexity, compliance requirements)
demand it, not preemptively.

---

## 5. Current infra status (as of this document's creation)

### DigitalOcean Droplet — ✅ PROVISIONED
- Name: `ubuntu-s-2vcpu-4gb-120gb-intel-sgp1`
- Region: **Singapore (SGP1)**
- Specs: 2 vCPU (Premium Intel), 4GB RAM, 120GB NVMe SSD, 4TB bandwidth
- Cost: $32/month
- OS: Ubuntu 24.04 LTS
- Public IPv4: `159.223.72.11`
- SSH: key-based auth working (`ssh root@159.223.72.11`), private key
  backed up in password manager
- System: fully updated (`apt update && upgrade` done, kernel rebooted to
  latest)
- **Docker**: installed, v29.6.2
- **Docker Compose**: bundled, v5.3.1
- **Firewall (ufw)**: active — ports 22 (OpenSSH), 80/tcp, 443/tcp allowed
  (IPv4 + IPv6), all else denied by default

### Supabase — ✅ PROJECT CREATED
- Project name: `education-i2`
- Project ID: `ojwyadivikfnhfkelizd`
- Region: **Singapore (ap-southeast-1)** — correctly matched to Droplet
  region (an earlier project was accidentally created in Seoul/
  `ap-northeast-2` and should be deleted if not already)
- API keys (publishable + secret) generated — stored in password manager,
  **not** in this file or repo
- Database connection string — stored in password manager
- **Not yet done**: schema not yet created (tenants/documents/chunks
  tables, pgvector extension not yet enabled)

### Not yet set up (deferred until API layer exists)
- nginx reverse proxy
- SSL/Let's Encrypt
- Domain/subdomain pointing at Droplet
- Cloudflare
- DO backups (recommended to enable once real data exists)
- CI/CD

### Credentials handling — IMPORTANT
All secrets (Supabase keys, DB password, Anthropic/OpenAI API keys, SSH
private key) live **only** in the developer's password manager. Never commit
them to this repo. Use a `.env` file (git-ignored) for local/Droplet config,
reference `.env.example` with placeholder keys in the repo for structure.

---

## 6. Build sequence / roadmap

### Phase 0 — Prove the concept (1 pilot tenant) ← WE ARE HERE
Infra (§5) is done. Remaining Phase 0 work, in order:
1. **Postgres schema** — tenants, documents, chunks tables + pgvector
   extension, RLS policies (even if only one tenant exists, build RLS now)
2. **Ingestion script** — take one real sample document (a pilot
   university's FAQ/brochure), parse → chunk → embed → store
3. **RAG query script** — take a question, retrieve top-k chunks, call
   Claude, return a structured block-schema JSON response — start with just
   3-4 block types (plain text answer, stat grid, comparison table, FAQ
   accordion)
4. **FastAPI wrapper** around the query script, Dockerized, running on the
   Droplet (test via `http://159.223.72.11:8000` before any domain/SSL)
5. **Minimal Next.js frontend** — call the API, render 1-2 block types,
   confirm the persistent-shell + progressive-fill UX pattern feels right

**Do not proceed past step 3 until retrieval + generation quality is
genuinely good on real content.** This is the highest-risk part of the
whole product — everything else (multi-tenancy, theming, admin portal) is
comparatively low-risk engineering that can wait.

### Phase 1 — Multi-tenant, second university
6. Tenant isolation hardening (RLS across all tables), Superadmin portal
   basics
7. Theme engine (CSS-variable driven, per-tenant)
8. Crawler + admin approval workflow (staged → approved)
9. Lead capture + one CRM integration
10. nginx + SSL + real domain, now that there's something worth exposing
    properly

### Phase 2 — Scale-readiness
11. Usage metering, plan tiers, billing
12. Full block-type library, WhatsApp integration, analytics dashboard
13. Migrate pieces up the scale-stack only as real signals demand it (see
    §4 "Scale-up path")

---

## 7. Conventions for Claude Code to follow in this repo

- **Language/stack**: Python (FastAPI) backend, TypeScript/Next.js frontend.
- **Multi-tenancy is not optional at any stage** — even Phase 0's single-
  tenant code should have `tenant_id` on every relevant table and RLS
  policies from the first migration, not retrofitted later.
- **No web-search/browsing tool** should ever be wired into the student-
  facing AI assistant's tool access, under any circumstance.
- **Structured output over free text** — any AI-generated response destined
  for the frontend must go through the JSON block schema, never raw HTML
  or unstructured markdown rendered directly.
- **Never hardcode branding values** (colors, fonts) in components — always
  read from the tenant theme object / CSS variables.
- Commit messages: clear, scoped (e.g. `feat(ingestion): add PDF chunking
  pipeline`), following conventional-commits style if reasonable.
- Branch per feature; PRs before merging to `main`; do not auto-merge to
  `main` unsupervised.
- Secrets always via `.env` (git-ignored) — never hardcoded, never
  committed, never printed in logs.
