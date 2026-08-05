# AoC Control Line — DORA Article 12 Demonstrator

A Next.js 16 interactive demonstrator showing how AI-assisted tooling can compress a full DORA Article 12 (ICT backup) compliance workflow from ~74 person-hours to ~17 — while keeping every human approval gate intact.

---

> **SYNTHETIC DEMONSTRATION DATA ONLY**
>
> All regulation text, applications, cloud resources, control activities, policy evaluations, and DDCR records in this demonstrator are entirely fictional. No client data, no real Azure subscription, no actual Azure Policy service. The control activity identifier BR0039-GR is invented for this demonstration and does not correspond to any real internal or regulatory framework. Hour estimates are illustrative assumptions, not benchmarks derived from client engagements.

---

## Architecture

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Database | SQLite via better-sqlite3, schema managed by Drizzle ORM |
| AI Provider | OpenAI (o3 for reasoning, gpt-4o for IaC generation, gpt-4o-mini for documentation) or deterministic offline mode |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Testing | Vitest with node environment |

The entire application runs from a single SQLite file (`./data/aoc.db`). No external services, message queues, or cloud accounts are required for the offline/deterministic mode.

```
app/                  Next.js App Router pages and API routes
lib/
  db/
    index.ts          SQLite connection, table DDL, Drizzle instance
    schema.ts         Drizzle schema definitions
    seed.ts           Seed script for demo data
  state-machine.ts    Demo workflow state machine (11 states)
  policy-engine.ts    Policy evaluation logic (POL-BACKUP-001/002, POL-EDR-001, POL-ENC-001, POL-LOG-001)
  ddcr-adapter.ts     DDCR work-product derivation from policy evaluations
  ai/                 AI provider abstraction (deterministic + OpenAI)
__tests__/            Vitest unit tests
docs/                 Demo script and disclaimer documentation
```

## Prerequisites

- Node.js 18 or later
- npm 9 or later
- No other services required for offline mode

## Setup

```bash
git clone <repository-url>
cd ProReinsuranceAIWorkflow

npm install

# Seed the database with demo fixtures
npm run db:seed

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The seed script creates the SQLite database at `./data/aoc.db`, initialises all tables, and inserts the full set of synthetic demo data including the DORA Article 12 regulation fixture, BR0039 and BR0039-GR control activities, APP-X-001 application, cloud resource snapshots, and value assumption records.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values as needed:

```bash
cp .env.example .env.local
```

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `./data/aoc.db` | Path to the SQLite database file |
| `AI_PROVIDER` | `deterministic` | `deterministic` for offline mode, `openai` for live AI calls |
| `OPENAI_API_KEY` | — | Required when `AI_PROVIDER=openai` |
| `OPENAI_ORG_ID` | — | Optional OpenAI organisation ID |
| `GITHUB_ENABLED` | `false` | Set `true` to enable GitHub PR integration |
| `GITHUB_TOKEN` | — | Required when `GITHUB_ENABLED=true` |
| `GITHUB_REPO` | — | Target repository for IaC PR creation (format: `owner/repo`) |

See `.env.example` for the full list with descriptions.

## Six-Stage Compliance Journey

The demonstrator walks through a single compliance change triggered by a new DORA Article 12 requirement for geo-redundant backup storage.

| Stage | Name | What happens |
|---|---|---|
| 0 | Baseline | APP-X-001 is non-compliant: RecoveryVault uses LocallyRedundant storage, no geo-redundancy control exists |
| 1 | Standard Proposed | AI reads DORA Article 12 fixture, proposes an update to BR Guideline v3.2 → v3.3 and a new control activity BR0039-GR. Human approval gate. |
| 2 | IaC Change | AI generates a Terraform diff adding geo-redundant RecoveryVault and BackupProtectedItem resources. Human approves PR and deployment. |
| 3 | Policy Verified | Policy engine evaluates the simulated post-deployment cloud state against POL-BACKUP-001 and POL-BACKUP-002. Results flip from NonCompliant to Compliant. |
| 4 | DDCR Updated | DDCR adapter automatically derives "Backup Job Configuration" work product status as Fulfilled from the passing policy evaluations. No manual DDCR entry. |
| 5 | Documentation | AI generates updated SDD and Operating Manual sections. Human approves. |
| 6 | Evidence Ready | Full evidence chain compiled: regulation → guideline → control → IaC → deployment → policy evaluation → work product → documentation. Audit question answered in seconds. |

## AI Provider

### Deterministic (Offline) Mode

`AI_PROVIDER=deterministic` (the default). All AI outputs are pre-scripted fixtures stored in `lib/ai/`. No API key required. Useful for demos in environments without internet access or when predictable outputs are preferred.

### OpenAI Mode

`AI_PROVIDER=openai`. Requires a valid `OPENAI_API_KEY`.

| Task | Model | Rationale |
|---|---|---|
| Regulation analysis and guideline proposal | o3 | Complex multi-step reasoning over regulatory text |
| IaC Terraform generation | gpt-4o | Strong code generation with structured output |
| Documentation updates | gpt-4o-mini | Cost-efficient for lower-complexity drafting tasks |

All AI calls operate exclusively on synthetic demo data. No client or production information is ever sent to the OpenAI API.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js development server on http://localhost:3000 |
| `npm run build` | Build for production |
| `npm run start` | Start the production build |
| `npm run test` | Run all Vitest unit tests once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run db:seed` | Seed (or re-seed) the database with demo fixtures |
| `npm run db:reset` | Drop all data and re-seed from scratch |
| `npm run lint` | Run ESLint |

## Limitations and Assumptions

- **Single demo run**: The state machine is designed for a single sequential demo run (`DEMO-RUN-001`). Parallel runs are not supported.
- **Simulated deployment**: No Terraform is actually executed. The post-deployment cloud state is a fixture inserted into the SQLite database to simulate what Azure Resource Manager would return.
- **Policy engine**: Policy evaluation is implemented as in-process TypeScript logic, not connected to Azure Policy. Results are deterministic based on the cloud resource fixture.
- **DDCR**: The Compliance Work Products table simulates a simplified DDCR. It does not integrate with any real GRC or ITSM platform.
- **Hour assumptions**: Stage hour estimates (32h/8h for Stage 1, etc.) are illustrative and based on workshop estimates, not time-and-motion studies from client engagements.
- **GitHub integration**: Disabled by default. When enabled, requires a GitHub token with PR creation permissions on the target repository. The IaC diff is always synthetic.
- **Test isolation**: Tests write to a separate `./data/test-aoc.db` database controlled by `process.env.DATABASE_URL`. Run `npm test` before seeding to avoid state bleed.
