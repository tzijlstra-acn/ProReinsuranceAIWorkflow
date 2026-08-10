# AoC Control Line — Implementation Plan

## Overview
Executive-grade Automation of Compliance demonstrator. Synthetic DORA Article 12 storyline:
Regulation → Standard → Control → Code → Verification → Reporting → Documentation → Evidence

## Stack decisions
| Decision | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | SSR + API routes in one command |
| Language | TypeScript strict | Runtime safety, schema alignment |
| Database | SQLite via better-sqlite3 | Zero-infra, version-controlled seed |
| ORM | Drizzle ORM | Type-safe, lightweight, SQL-close |
| Styling | Tailwind CSS + shadcn/ui | Executive polish, accessible |
| State machine | XState v5 | Explicit, tested, idempotent |
| Charts | Recharts | Works SSR, good TS types |
| Testing | Vitest + Playwright | Unit + E2E in one stack |

## Assumptions (recorded, reversible)
1. `ProReinsuranceAIWorkflow` repo is the target — `npm install && npm run dev` is the startup command.
2. "GRZ" is rendered in UI as "Geo-Redundant Storage (GRZ)" with technical mapping `storageRedundancy: "GeoRedundant"`.
3. Deterministic AI provider uses template strings seeded from the evidence graph — no external calls required.
4. Simulated Azure/Policy/DDCR/ProductHub are local in-process services, not separate servers.
5. All IaC examples use Terraform HCL for readability; no Bicep unless existing code establishes it.
6. Portfolio seed: 25 synthetic apps; IT App X (APP-X-001) is the demo subject.
7. GitHub integration disabled by default (`GITHUB_INTEGRATION_ENABLED=false`).
8. EUR-Lex live fetch is optional; demo works fully offline from checked-in fixture.
9. PDF export is skipped in Phase 1; JSON+Markdown evidence pack is implemented.
10. Board Mode approval gates are simulated with a "Demo Approve" button that logs a synthetic reviewer.

## Risks
- XState v5 API changes — will pin exact version.
- shadcn/ui requires manual component scaffolding — will use CLI batch install.
- SQLite WAL on Windows — will set `PRAGMA journal_mode=WAL` at startup.

## Phase checklist

### Phase 1 — Foundation ✅
- [ ] `npx create-next-app` with TypeScript + Tailwind + App Router
- [ ] Drizzle schema: all 20+ entities
- [ ] SQLite seed script (25 apps, baseline state)
- [ ] State machine (11 states, all transitions, audit events)
- [ ] Reset command
- [ ] `.env.example`

### Phase 2 — Core UI ✅
- [ ] Home page with 6-step stepper + Run E2E button
- [ ] Before/After toggle (IT App X compliance state)
- [ ] Persistent audit timeline sidebar
- [ ] Board Mode with presenter notes
- [ ] Traceability view
- [ ] Synthetic data banner

### Phase 3 — Stage 1: Define Standards ✅
- [ ] DORA Article 12 regulation fixture + EUR-Lex adapter
- [ ] Guideline diff v3.2 → v3.3 (side-by-side)
- [ ] Control Activity proposal (BR0039 / BR0039-GR)
- [ ] AI provenance display
- [ ] Human approval gate (approve/reject + comment)

### Phase 4 — Stage 2: Integrate Controls ✅
- [ ] IaC change generation (Terraform HCL diff)
- [ ] Simulated PR (branch, SHA, checks, CI stages)
- [ ] Human approval gate
- [ ] Simulated deployment → local cloud-state update

### Phase 5 — Stages 3–4: Verify + Report ✅
- [ ] Policy engine (POL-BACKUP-001, POL-BACKUP-002 + 3 context policies)
- [ ] Before/after re-evaluation on cloud state
- [ ] DDCR adapter + work product fulfilment table
- [ ] Portfolio dashboard
- [ ] Evidence timestamps

### Phase 6 — Stage 5: Documentation ✅
- [ ] SDD and Operating Manual versioned document model
- [ ] AI-generated proposal from deployed config
- [ ] Diff view (existing → proposed)
- [ ] Human approval gate

### Phase 7 — Stage 6: Evidence ✅
- [ ] RQMT audit assistant (evidence-graph based, not free-form)
- [ ] Full traceability matrix with internal links
- [ ] Export Evidence Pack (JSON + Markdown)
- [ ] Portfolio fulfilment percentage + exceptions

### Phase 8 — Value + Quality ✅
- [ ] Value calculator (editable assumptions, waterfall chart)
- [ ] Unit tests (state machine, policy logic, DDCR, value formulas)
- [ ] E2E test (happy path)
- [ ] Lint + type check passing
- [ ] All docs (README, architecture, demo-script, value-model, data-dictionary, assumptions)

---

## Board Demo Refactor (2026-Q3)

### Goal
Reframe the demonstrator as a board-ready story with three explicit levels, a persistent end-to-end flow ribbon, and client footage placeholders.

### Three levels
| Level | Label | Purpose |
|---|---|---|
| STEP 1 | Existing foundation | What Munich Re already has — three activities with manual handovers |
| STEP 2 | Connected pilot | One coherent case from regulatory change to DDCR COMPLIANT, MITRA + MAYA clearly labelled |
| NORTH STAR 2030 | Vision | Full-screen animated view — five regulatory sources → end-to-end orchestration → enterprise DDCR |

### Implementation completed ✅
- [x] `app/demo/page.tsx` — full rewrite: flow ribbon, level selector, Step 1 panels, Step 2 case + activity tabs, North Star 2030 view
- [x] `lib/terminology.ts` — single source of truth for all UI labels
- [x] `data/client-assets.ts` — 9-slot Munich Re recording manifest
- [x] `docs/MUNICH_RE_TERMINOLOGY.md` — approved terminology glossary
- [x] `docs/TERMINOLOGY_DECISIONS.md` — open MAYA/MITRA confirmation items
- [x] `docs/MUNICH_RE_ASSET_REQUESTS.md` — 9 detailed recording requests
- [x] `docs/DEMO_STORY.md` — three-chapter narrative
- [x] `app/product-hub/page.tsx` — action cockpit with MAYA/MITRA buttons
- [x] `app/api/product-hub/inbox/route.ts` — published control changes + stage derivation
- [x] `app/api/product-hub/products/[id]/maya/route.ts` — document generation via AI
- [x] `app/api/product-hub/products/[id]/mitra/route.ts` — gap assessment via AI
- [x] Solvency II added as 5th regulatory source in `lib/db/seed.ts`
- [x] `__tests__/nis2-incident-handling.test.ts` — 7 tests covering NIS2 Art. 21(2)(b) incident handling workflow (non-backup scenario)
- [x] Product Hub "MITRA" labels corrected to "MAYA" per approved terminology

### Open items
- Client footage: 9 recordings listed in `docs/MUNICH_RE_ASSET_REQUESTS.md` — add `videoUrl` to `data/client-assets.ts` once received
- MAYA/MITRA final confirmation from Munich Re — see `docs/TERMINOLOGY_DECISIONS.md`
- Pre-existing TS error in `app/api/portfolio/compliance/route.ts:35` (boolean/number comparison) — not introduced in this refactor

### Terminology rule (enforced)
- **MITRA** = Compliance Hub only (regulatory analysis, policy/control gap analysis)
- **MAYA** = Product Hub only (work-product analysis, documentation, migration, remediation)
- Never interchangeable. All UI labels sourced from `lib/terminology.ts`.
