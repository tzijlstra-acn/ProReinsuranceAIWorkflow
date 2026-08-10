# Automation of Compliance — Munich Re Multi-Regulation Platform

A Next.js 16 platform demonstrating AI-assisted compliance automation across multiple EU regulations (DORA, NIS2, GDPR) for a financial institution product portfolio. The platform covers the full lifecycle from regulatory gap identification to DDCR-compliant status, orchestrated through a three-team workflow.

---

> **SYNTHETIC DEMONSTRATION DATA ONLY**
>
> All regulation text, products, compliance gaps, control changes, and DDCR records are entirely fictional. No client data, no real regulatory submissions, no actual cloud resources. All AI calls operate exclusively on synthetic demo data — no client or production information is ever sent to the OpenAI API.

---

## Platform Overview

The platform organises compliance work across three teams and six application areas:

```
Compliance Team → Product Team → DDCR Team
      ↓                ↓              ↓
  Gap analysis    Remediation    Compliance gate
  Control change  Verification   COMPLIANT status
  Publish         Evidence       DDCR reporting
```

### Navigation

| Route | Area | Purpose |
|---|---|---|
| `/` | Dashboard | KPI tiles + multi-regulation product status matrix |
| `/workflow` | Workflow | E2E three-column pipeline with bulk approve |
| `/compliance-hub` | Compliance Hub | Regulations, gaps, control changes, regulatory updates |
| `/product-hub` | Product Hub | Product compliance matrix, per-product gap + work product view |
| `/ddcr` | DDCR | Compliance gate, status transitions, reporting records |
| `/remediation` | Remediation | Case management with AI-suggested action plans |
| `/portfolio` | Portfolio | Cross-product portfolio compliance overview |
| `/evidence-centre` | Evidence Centre | Evidence packages and audit artefacts |
| `/demo` | Board Demo | Structured presenter walkthrough with Platform Tour tab |

---

## Architecture

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Database | SQLite via better-sqlite3, schema via Drizzle ORM |
| AI Provider | OpenAI — o3 (reasoning), gpt-4o (suggestions), gpt-4o-mini (writing) |
| Styling | Tailwind CSS v4 |
| Testing | Vitest |

All data is stored in a single SQLite file (`./data/aoc.db`). No external services or cloud accounts are required.

### Key architectural rules

- All DB calls are **synchronous** (better-sqlite3 `.all()` / `.get()` / `.run()`) — never `await` a DB call
- Only AI calls (`await ai.method(...)`) are async
- Pages use `'use client'` + `useEffect` + `fetch()` — they never import the DB directly
- `NoAiProvider` throws a clear error rather than returning fake data — AI is either real or fails loudly

---

## Database Schema (18 tables)

**Regulatory domain**
- `regulatory_sources` — DORA, NIS2, GDPR source records
- `regulatory_versions` — Version history per regulation
- `regulatory_requirements` — Individual articles and obligations
- `internal_documents` — Internal policies and procedures
- `requirement_document_mappings` — Maps requirements to documents

**Compliance domain**
- `compliance_gaps` — Identified gaps with severity and AI analysis
- `control_changes` — Proposed control changes (DRAFT → PROPOSED → APPROVED → PUBLISHED)
- `requirement_status_history` — Audit trail of requirement status changes

**Product domain**
- `products` — Product catalogue (PROD-APP-X, Y, Z, V)
- `product_applicability` — Which regulations apply to which products
- `product_gaps` — Product-specific unfulfilled requirements
- `work_product_definitions` — Required deliverables per requirement
- `product_work_products` — Fulfilment status of each deliverable

**Verification & evidence**
- `verification_criteria` — Automated and manual check definitions
- `verification_results` — Results of verification runs
- `evidence_packages` — Assembled evidence for DDCR submission

**Remediation**
- `remediation_cases` — Case lifecycle (OPEN → IN_PROGRESS → RESOLVED)

**Reporting**
- `ddcr_reporting_records` — Per product × requirement DDCR status

---

## AI Features

All AI calls go through `lib/ai/provider.ts` → `OpenAiProvider`. The `NoAiProvider` (no API key) throws rather than returning synthetic data.

| Feature | Model | Route |
|---|---|---|
| Gap analysis from requirement + documents | o3 | `POST /api/compliance-hub/requirements/[id]/analyze` |
| Control change generation from gap | o3 | `POST /api/compliance-hub/gaps/[id]/generate-change` |
| Regulatory delta analysis on version update | o3 | `POST /api/compliance-hub/regulatory-updates/[versionId]/analyze` |
| Audit question answering | o3 | `POST /api/audit/answer` |
| Remediation step suggestions | gpt-4o | `POST /api/remediation/cases/[id]/suggest` |
| Bulk approve all — generate + approve + publish + create cases | o3 | `POST /api/workflow/bulk-approve` |

### Bulk Approve Flow

The Workflow page includes a one-click "Process All Gaps" panel that runs sequentially:

1. **Generate** — AI generates a control change for every OPEN gap with no existing change
2. **Approve** — All DRAFT/PROPOSED/UNDER_REVIEW changes are approved with the given approver name
3. **Publish** — All APPROVED changes are published
4. **Dispatch** — Remediation cases auto-created for all applicable product × requirement combos, appearing immediately in the Product Team column

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
npm run db:reset

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes (for AI) | OpenAI key — o3 requires tier 3+ access |
| `DATABASE_URL` | No | Defaults to `./data/aoc.db` |
| `NEXT_PUBLIC_APP_NAME` | No | Displayed in browser tab |

If `OPENAI_API_KEY` is not set, all AI buttons will fail with a clear error — no silent fallback to fake data.

---

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Development server on http://localhost:3000 |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run db:reset` | Drop all data and re-seed from scratch |
| `npm run test` | Run Vitest unit tests |
| `npm run lint` | ESLint |

### DB reset workflow (if dev server is running)

The SQLite file is locked while the dev server holds it. To re-seed:

```powershell
# Find and stop the dev server
Get-NetTCPConnection -LocalPort 3000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }

# Re-seed
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
npm run db:reset

# Restart
npm run dev
```

---

## Demo Products & Regulations

### Products in scope

| ID | Name | Criticality |
|---|---|---|
| PROD-APP-X | IT Application X | HIGH |
| PROD-APP-Y | Data Analytics Platform | HIGH |
| PROD-APP-Z | Customer Portal | MEDIUM |
| PROD-APP-V | AI Underwriting Engine | CRITICAL |

### Regulations in scope

| Code | Full name |
|---|---|
| DORA | Digital Operational Resilience Act |
| NIS2 | Network and Information Security Directive 2 |
| GDPR | General Data Protection Regulation |

---

## Project Structure

```
app/
  page.tsx                    Dashboard (root)
  workflow/                   E2E pipeline page
  compliance-hub/             Gap analysis, regulations, control changes
  product-hub/                Product matrix and per-product views
  ddcr/                       DDCR gate and reporting
  remediation/                Case management
  portfolio/                  Portfolio overview
  evidence-centre/            Evidence packages
  demo/                       Board demo presenter view
  api/
    compliance-hub/           Gap, control change, requirement, regulatory update APIs
    product-hub/              Product compliance + gaps APIs
    ddcr/                     Status transition + reporting APIs
    remediation/              Case CRUD + AI suggest API
    verification/             Verification run API
    workflow/                 Pipeline state + bulk approve APIs
    dashboard/                KPI summary API

lib/
  ai/provider.ts              OpenAI provider (o3 / gpt-4o / gpt-4o-mini) + NoAiProvider
  db/
    index.ts                  SQLite connection, table DDL (18 tables)
    schema.ts                 Drizzle schema definitions
    seed.ts                   Full demo data seed
  domain/
    compliance-hub.ts         Compliance gap + control change domain functions
    product-hub.ts            Product compliance domain functions
    remediation.ts            Remediation case domain functions
    ddcr/status-engine.ts     DDCR four-gate compliance transition engine
    verification/             Verification criteria runner

components/
  MainNav.tsx                 Top navigation bar

__tests__/                    Vitest unit tests
```
