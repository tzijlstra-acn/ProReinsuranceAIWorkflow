# Munich Re — Platform Terminology

All approved terms for the Automation of Compliance platform.
The single authoritative source is `lib/terminology.ts`.
This document explains each term and its approval status.

---

## Approved Terms

| Term | Label | Context |
|---|---|---|
| Compliance Hub | `Compliance Hub` | The regulatory-analysis and policy/control management platform |
| Product Hub | `Product Hub` | The product-team-facing compliance cockpit |
| DDCR | `DDCR` | The governance and reporting layer |
| Essentials | `Essentials` | The product compliance framework (applicability criteria + work product definitions) |
| Work product | `work product` | A document or artefact a product team must produce to demonstrate compliance |
| SDD | `SDD` | Solution Design Document |
| Operating Manual | `Operating Manual` | The operational run-book for a product |
| Finding | `finding` | A product-level compliance issue identified by the Product Hub |
| Actionable task | `actionable task` | A work item raised for the Product Team as a result of a finding |
| Migration view | `migration view` | The change-review area in the Product Hub where proposed changes are reviewed |
| Control Activity | `Control Activity` | An internal compliance control definition (maps a regulation to an automated test or process step) |
| Non-compliant | `Non-compliant` | Negative compliance status |
| Compliant | `Compliant` | Positive compliance status |

---

## AI Assistant Names

| Name | Platform | Role |
|---|---|---|
| **MITRA** | Compliance Hub | Regulatory analysis and policy/control gap analysis |
| **MAYA** | Product Hub | Work-product analysis, documentation updates, migration support, proposed product remediation |

> **Important:** These names are provisionally assigned. See `docs/TERMINOLOGY_DECISIONS.md` for the open confirmation item.

---

## Not Approved

The following generic terms must **not** be used in the UI or documentation
where one of the approved terms above is available:

- "GRC bot" → use MITRA or MAYA as appropriate
- "remediation inbox" → use Product Hub or Actionable tasks
- "AI copilot" → use MITRA or MAYA as appropriate
- "compliance dashboard" → use Compliance Hub, Product Hub, or DDCR
- "control change" as a user-facing label → use Control Activity or internal change
