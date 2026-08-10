# ProReinsurance AI Compliance Workflow

A Next.js 16 platform demonstrating AI-assisted compliance automation across five EU regulations (DORA, NIS2, GDPR, EU AI Act, Solvency II) for a financial institution product portfolio. The platform covers the full lifecycle: from live regulatory scanning to gap identification, AI-generated control changes, product-level document updates, evidence assembly, and DDCR reporting — all driven by real AI calls with no pre-populated fake results.

The reference scenario is DORA Article 12 backup geographic redundancy — one concrete end-to-end case that can be followed step by step. The platform is regulation-agnostic: the same workflow applies to NIS2, GDPR, EU AI Act and Solvency II.

---

> **SYNTHETIC DEMONSTRATION DATA ONLY**
>
> All regulation text, products, compliance gaps, control changes, and DDCR records are entirely fictional. No client data, no real regulatory submissions, no actual cloud resources. All AI calls operate exclusively on synthetic demo data — no client or production information is ever sent to the OpenAI API.

---

## Platform Overview

Three teams, one end-to-end workflow:

```
Compliance Team           Product Team              DDCR / Evidence
──────────────────        ────────────────────      ──────────────────────
Scan EUR-Lex              Click MAYA → update       Confirm compliant
Identify gaps             System Design Doc         Resolve gaps
AI proposes controls      Operating Manual          Assemble evidence
Sign off changes          IaC Terraform             Log to Evidence Centre
Publish to product teams  Confirm compliant         DDCR auto-updated
```

---

## Navigation

| Route | Purpose |
|---|---|
| `/compliance-hub` | Regulatory intelligence scanner, gap identification, AI-recommended control changes with sign-off |
| `/product-hub` | Product list with pending change indicators; per-product compliance by regulation |
| `/product-hub/products/[id]` | Per-regulation compliance status, open gaps, MAYA document updates, confirm compliant |
| `/evidence-centre` | Evidence packages, logbook (all compliance events), AI chat over compliance data |
| `/ddcr` | Federated DDCR cockpit aggregating status from PRODUCT_HUB, ServiceNow, Archer, GitLab |
| `/portfolio` | Cross-product compliance portfolio view |
| `/audit` | Audit question answering |
| `/traceability` | End-to-end traceability chain |

---

## Architecture

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Database | SQLite via better-sqlite3, schema via Drizzle ORM |
| AI | OpenAI — o3 (regulatory reasoning), gpt-4o (evidence chat, document updates) |
| Styling | Tailwind CSS v4 |
| Testing | Vitest |

All data is stored in a single SQLite file (`./data/aoc.db`). No external services or cloud accounts required.

### Key rules

- All DB calls are **synchronous** (better-sqlite3 `.all()` / `.get()` / `.run()`) — never `await` a DB call
- Only AI calls (`await ai.method(...)`) are async
- Pages use `'use client'` + `useEffect` + `fetch()` — they never import the DB directly
- `NoAiProvider` throws a clear error rather than returning fake data — AI is real or fails loudly
- No pre-populated AI results — every AI response is generated live on demand

---

## AI Features

All AI calls go through `lib/ai/provider.ts` → `OpenAiProvider`.

| Feature | AI | Model | Route |
|---|---|---|---|
| Regulatory intelligence scan (EUR-Lex) | MITRA | o3 | `POST /api/compliance-hub/scan` |
| Gap analysis (requirement × internal docs) | MITRA | o3 | `POST /api/compliance-hub/requirements/[id]/analyze` |
| Control change proposal + approve for gap | MITRA | o3 | `POST /api/compliance-hub/gaps/[id]/propose-all` |
| Approve gap proposal | MITRA | o3 | `POST /api/compliance-hub/gaps/[id]/approve-all` |
| Regulatory delta analysis on version update | MITRA | o3 | `POST /api/compliance-hub/regulatory-updates/[versionId]/analyze` |
| Compliance gap assessment per product | MAYA | o3 | `POST /api/product-hub/products/[id]/mitra` |
| Document update proposals (SDD, Operating Manual, IaC, Policy, Procedure) | MAYA | o3 | `POST /api/product-hub/products/[id]/maya` |
| Audit question answering | — | o3 | `POST /api/audit/answer` |
| Evidence Centre chat | — | gpt-4o | `POST /api/evidence-centre/chat` |

**AI Assistant naming:**
- **MITRA** — Compliance Hub. Regulatory scanning, gap analysis, control change generation.
- **MAYA** — Product Hub. Per-product document updates, compliance gap assessment.

---

## End-to-End Workflow

### Compliance Hub

1. **Regulatory Intelligence Scanner** — embedded on the Compliance Hub main page. Scans EUR-Lex for updates; AI identifies new gaps and impacted controls. Results show inline (no separate page).
2. **Gaps** — each gap shows severity, type, affected documents. Click "Get AI recommendation" for MITRA to propose a control change (NEW CONTROL or AMEND EXISTING flagged clearly).
3. **Changes** — one-line summary per change; expand for: control objective, regulatory trigger (articleRef, clauseText, deadline), implementation steps, acceptance criteria, policy documents to update. Quick sign-off without opening a separate page.
4. **Regulations count** is hidden by default — revealed on demand. Open gaps only appear after scanner runs.

### Product Hub

1. **Product list** — each product shows a status dot (amber = changes pending, green = up to date) and pending change count.
2. **Product detail** — compliance grouped by regulation. Each requirement row shows: status, open gaps, work products generated.
3. **MAYA — Assess compliance gaps** — runs AI gap analysis against the product's context for a specific requirement.
4. **MAYA — Update documents** — for each internal document linked to the requirement (System Design Document, Operating Manual, IaC Terraform, Policy, Procedure, Control), MAYA proposes AI-generated amendments. Each update shows change summary, added clauses, and proposed content.
5. **Confirm compliant** — once AI work is done, one-click confirmation: resolves all open gaps, assembles a COMPLETE evidence package, creates verification results, writes to `requirementStatusHistory`, and auto-updates the DDCR cockpit.

### Evidence Centre

Three tabs:

- **Evidence Packages** — card grid showing all assembled packages with status (COMPLETE / ASSEMBLING / REJECTED) and link to DDCR.
- **Logbook** — vertical timeline aggregating all compliance events from the database: status changes, gap detections, gap resolutions, control changes, evidence packages assembled, verification results. Filter by event type. Everything logged automatically — no manual entries.
- **Ask AI** — persistent chat over the full compliance dataset. Suggested questions provided; conversation history passed for context.

### DDCR (Digital Documentation & Compliance Reporting)

Federated cockpit aggregating compliance status from multiple source systems:

| Source | What it covers |
|---|---|
| PRODUCT_HUB | Documentation and work product compliance per product |
| SERVICENOW | Vulnerability and patch management |
| ARCHER | Risk register and exception management |
| GitLab | Pipeline and code quality compliance |

When **Confirm compliant** is triggered in Product Hub, the DDCR cockpit items for that product × regulatory framework are automatically updated (executionStatus → COMPLETED, reportingStatus → COMPLIANT).

---

## Database Schema

**Regulatory domain**
- `regulatory_sources` — DORA, NIS2, GDPR, EU AI Act, Solvency II
- `regulatory_versions` — version history per regulation
- `regulatory_requirements` — individual articles and obligations
- `internal_documents` — policies, procedures, guidelines, controls, system design docs, operating manuals, IaC configs
- `requirement_document_mappings` — which documents address which requirements (with coverage status)

**Compliance domain**
- `compliance_gaps` — identified gaps with severity, gap type, AI analysis
- `control_changes` — DRAFT → PROPOSED → APPROVED → PUBLISHED lifecycle
- `requirement_status_history` — audit trail of every status transition (source of truth for compliance status)

**Product domain**
- `products` — IT App X, Trading Platform, Customer Portal, Internal Analytics, AI Underwriting Engine
- `product_applicability` — which regulations apply to which products
- `product_gaps` — product-specific open gaps
- `work_product_definitions` — SDD, Operating Manual, IaC, Post-Incident Review, etc.
- `product_work_products` — fulfilment status + AI-generated content per deliverable

**Verification & evidence**
- `verification_criteria` — automated and manual checks per requirement
- `verification_results` — PASSED/FAILED results per product × criterion
- `evidence_packages` — assembled evidence packages (ASSEMBLING → COMPLETE → REJECTED)

**Reporting**
- `ddcr_reporting_records` — per product × requirement compliance status (feeds DDCR summary API)
- `ddcr_items` — federated cockpit items per source system (PRODUCT_HUB, SERVICENOW, ARCHER, GitLab)
- `ddcr_item_history` — change history per cockpit item

**Logbook sources** (read by Evidence Centre logbook — no separate table)
- `requirement_status_history` → STATUS_CHANGE events
- `control_changes` → CONTROL_CHANGE events
- `compliance_gaps` / `product_gaps` → GAP_DETECTED / GAP_RESOLVED events
- `evidence_packages` → EVIDENCE_ASSEMBLED events
- `verification_results` → VERIFICATION events

---

## Products & Regulations in Scope

### Products

| ID | Name | Criticality | Hosting |
|---|---|---|---|
| PROD-APP-X | IT App X | HIGH | Azure |
| PROD-APP-Y | Trading Platform | CRITICAL | Azure |
| PROD-APP-Z | Customer Portal | HIGH | Azure |
| PROD-APP-W | Internal Analytics | MEDIUM | On-Premise |
| PROD-APP-V | AI Underwriting Engine | HIGH | Hybrid |

### Regulations

| Code | Regulation |
|---|---|
| DORA | Digital Operational Resilience Act |
| NIS2 | Network and Information Security Directive 2 |
| GDPR | General Data Protection Regulation |
| EU AI Act | EU Artificial Intelligence Act |
| Solvency II | Solvency II Directive |

---

## Setup

```bash
git clone git@github.com:tzijlstra-acn/ProReinsuranceAIWorkflow.git
cd ProReinsuranceAIWorkflow

npm install

# Copy and configure environment
cp .env.example .env.local
# Set OPENAI_API_KEY in .env.local

# Seed the database
npm run db:seed

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes (for AI features) | OpenAI key — o3 requires tier 3+ access |
| `DATABASE_URL` | No | Defaults to `./data/aoc.db` |

If `OPENAI_API_KEY` is not set, all AI buttons fail with a clear error — no silent fallback.

---

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Development server on http://localhost:3000 |
| `npm run build` | Production build |
| `npm run db:seed` | Seed (or re-seed) the database |
| `npm run db:reset` | Alias for db:seed |
| `npm run test` | Run Vitest unit tests |
| `npm run lint` | ESLint |

### Re-seeding while dev server is running

The SQLite file is locked while the dev server holds it. To re-seed:

```powershell
# Stop the dev server
Get-NetTCPConnection -LocalPort 3000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }

# Re-seed
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
npm run db:seed

# Restart
npm run dev
```

---

## Project Structure

```
app/
  page.tsx                        Root redirect / landing
  compliance-hub/
    page.tsx                      Scanner + gaps + control changes (main compliance workflow)
    regulations/                  Regulation list
    gaps/[gapId]/                 Gap detail
    changes/[changeId]/           Control change detail
    regulatory-intelligence/      Full scanner report
    regulatory-updates/[versionId]/  Version delta analysis
  product-hub/
    page.tsx                      Product list with pending change indicators
    products/[productId]/
      page.tsx                    Per-product compliance by regulation + MAYA actions
  evidence-centre/
    page.tsx                      Evidence packages · Logbook · Ask AI
  ddcr/
    page.tsx                      Federated compliance cockpit
    products/[productId]/         Per-product DDCR detail
  portfolio/                      Cross-product portfolio view
  audit/                          Audit question answering
  traceability/                   End-to-end traceability chain
  api/
    compliance-hub/               Gap, control change, scan, propose-all, approve-all APIs
    product-hub/                  Product compliance, gaps, MAYA, confirm-compliant APIs
    evidence-centre/              Logbook aggregation, AI chat API
    ddcr/                         DDCR summary, items, transition APIs
    verification/                 Verification run API

lib/
  ai/provider.ts                  OpenAI provider (o3 / gpt-4o) + NoAiProvider
  db/
    index.ts                      SQLite connection
    schema.ts                     Drizzle schema (26 tables)
    seed.ts                       Full demo data seed
  domain/
    ddcr/
      status-engine.ts            DDCR status engine + aggregate recompute
      items.ts                    DDCR federated cockpit query functions

components/
  MainNav.tsx                     Top navigation bar

__tests__/                        Vitest unit tests
docs/                             Terminology decisions and demo story
```
