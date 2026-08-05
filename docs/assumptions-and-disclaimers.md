# Assumptions and Disclaimers

This document records every material assumption and limitation of the AoC Control Line demonstrator. Any person using this tool for a client-facing presentation, a proof-of-concept assessment, or an internal capability review should read this document first.

---

## 1. All Data is Synthetic

Every piece of data in this application is entirely fictional and purpose-built for demonstration.

- **No client data** has been used at any point in the design, development, or seeding of this demonstrator.
- **No real Azure resources** exist. The cloud resource snapshots stored in the SQLite database (Recovery Vaults, Virtual Machines, Backup Protected Items) are in-memory fixtures that simulate what Azure Resource Manager would return. No Azure subscription has been accessed or modified.
- **APP-X-001** is a fictional application identifier. It does not correspond to any real system at any organisation.
- **Regulation text**: The DORA Article 12 fixture used in the demonstrator is a paraphrase constructed for demo purposes. It is not a verbatim reproduction of EUR-Lex content and should not be cited as legal authority.

---

## 2. BR0039-GR is a Fictional Control Activity Identifier

The control activity code `BR0039-GR` and the associated `BR0039` baseline are invented for this demonstrator. They do not correspond to any real control framework, internal policy library, regulatory standard, or industry benchmark. Any resemblance to real control identifiers is coincidental.

Control activities seeded in this demonstrator carry an `is_demo_data` flag and a `[DEMO DATA]` label to make their fictional status explicit in the UI.

---

## 3. Policy Evaluations are Simulated

All policy evaluations — including `POL-BACKUP-001` (VM Backup Enabled), `POL-BACKUP-002` (Backup Storage Geo-Redundant), `POL-EDR-001` (EDR Agent), `POL-ENC-001` (Disk Encryption), and `POL-LOG-001` (Diagnostic Logging) — are implemented as in-process TypeScript logic operating against the synthetic cloud resource fixtures in the SQLite database.

- The policy engine is **not** connected to Azure Policy, Azure Resource Graph, Microsoft Defender for Cloud, or any other real cloud governance service.
- Policy results are **deterministic**: they depend entirely on the resource fixture data written to the database during seeding or simulated deployment. They do not reflect the actual configuration of any real Azure environment.
- Evaluation results that appear "Compliant" or "NonCompliant" in the UI reflect simulated states only.

---

## 4. DDCR is a Fictional System

The "DDCR" (Data Domain Compliance Register) referenced throughout this demonstrator is a fictional construct. It is implemented as a local SQLite table (`compliance_work_products`) that simulates the kind of work product tracking a GRC or ITSM platform might provide.

- There is no integration with any real GRC platform (ServiceNow, Archer, MetricStream, or equivalent).
- The `deriveBackupJobConfigStatus` function that sets a work product to "Fulfilled" operates solely against the local policy evaluation records. It does not read from or write to any external system.
- "DDCR Updated" in the workflow means the local simulation table has been updated. It does not mean any real compliance register has been changed.

---

## 5. Hour Assumptions are Illustrative

The time estimates used in the value calculator and referenced in all business case materials are assumptions, not empirical measurements.

| Stage | Manual hours | AI-assisted hours | Basis |
|---|---|---|---|
| 1 — Regulation analysis & standard update | 32h | 8h | Workshop estimate |
| 2 — IaC generation | 16h | 4h | Workshop estimate |
| 3 — Policy evaluation | 4h | 0.75h | Workshop estimate |
| 4 — DDCR update | 2h | 0.25h | Workshop estimate |
| 5 — Documentation update | 8h | 2h | Workshop estimate |
| 6 — Audit evidence preparation | 12h | 2h | Workshop estimate |

"Workshop estimate" means these figures were constructed through structured discussion with subject matter experts familiar with compliance workflows in financial services. They have not been validated through time-and-motion studies, internal billing data, or benchmarking against live client engagements. They should be treated as order-of-magnitude indicators only.

If used in a business case, these figures should be replaced with actuals derived from the client's own process timing data before any financial commitment is made.

---

## 6. OpenAI Integration Uses Real Model Calls on Synthetic Data Only

When `AI_PROVIDER=openai` is configured, the application makes live API calls to the OpenAI API using the models listed below.

| Task | Model |
|---|---|
| Regulation analysis and guideline proposal | o3 |
| IaC Terraform generation | gpt-4o |
| Documentation drafting | gpt-4o-mini |

Safeguards:
- All prompts sent to the OpenAI API contain only synthetic data constructed within this application. No client information, personal data, or confidential business content is included in any prompt.
- The regulation text passed to the AI is the synthetic fixture, not any real regulatory document.
- Application identifiers, resource names, and control codes in prompts are all fictional.
- API calls are made server-side via Next.js API routes. API keys are never exposed to the browser.

Nevertheless, users should ensure their use of the OpenAI API complies with their organisation's data governance policies and any applicable data processing agreements before enabling live mode in a client environment.

---

## 7. GitHub Integration is Disabled by Default

The IaC PR creation feature that simulates raising a pull request on a GitHub repository is disabled by default (`GITHUB_ENABLED=false`).

When enabled:
- The application creates a pull request on the configured repository (`GITHUB_REPO`) using a GitHub personal access token (`GITHUB_TOKEN`).
- The IaC diff committed to the repository is the same synthetic Terraform fixture used throughout the demo. No real infrastructure code is written or executed.
- The PR is labelled and described as a demonstration artefact.

GitHub integration should not be enabled against production or shared repositories. Use a dedicated demo repository.

---

## 8. State Machine is Non-Reversible Past Terminal State

The demo state machine enforces a strict transition graph. Once the workflow reaches `EVIDENCE_READY`, no further transitions are permitted. To restart the demo, run `npm run db:reset` which drops all demo state and re-seeds from scratch.

The `DEPLOYED` state reflects a simulated deployment only. No rollback mechanism exists because no real deployment occurred.

---

## 9. This is Not Legal or Compliance Advice

Nothing in this demonstrator constitutes legal advice, regulatory guidance, or a compliance opinion. The fictional DORA Article 12 fixture, the fictional control activities, and the fictional policy evaluations are illustrative of the kind of workflow an AI-assisted compliance tool might support. They do not represent a complete, accurate, or legally sufficient interpretation of DORA or any other regulation.

Organisations subject to DORA should obtain independent legal and compliance advice from qualified professionals.
