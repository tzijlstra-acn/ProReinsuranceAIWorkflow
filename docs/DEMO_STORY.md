# Board Demo Story

## Narrative

The board demo tells a single story in three chapters:

> From a world where compliance is mostly manual, connected and partly automated,
> to a world where compliance is increasingly built into products by design.

The audience needs to answer three questions after watching:

1. **Where are we now?** (Step 1)
2. **What does connected and AI-assisted look like?** (Step 2)
3. **Where are we going?** (North Star 2030)

---

## Chapter 1 — Existing Foundation (Step 1)

### Purpose
Show what Munich Re already has, and make the manual handovers honest and visible.

### Three activities

**1. Review the Change**
A regulation, policy or guideline change is reviewed.
The relationship to internal guidelines, standards and Control Activities is checked.
Regulatory interpretation and mapping remain partly manual.

**2. Manage Product & Work Products**
Product Hub shows the selected product and application.
Essentials and applicability criteria determine which work products are required.
The Product Team opens an SDD, Operating Manual or other work product.
Existing tasks, comments, document editing and migration capabilities are visible.

**3. Report Current Status**
DDCR shows the relevant compliance or fulfilment status.
Reporting is present, but the handover from the Product Team is a separate step.

### Visual treatment
- Three equal panels side by side with dotted "manual handoff" arrows between them.
- Each panel shows a Munich Re recording placeholder (real footage replaces it later).
- An "Open in [app]" link lets the presenter switch to the live tool.
- Clearly labelled "EXISTING FOUNDATION" — not a fictional connected workflow.

---

## Chapter 2 — Connected End-to-End Pilot (Step 2)

### Purpose
Show one coherent case, from regulatory change to verified compliance,
with MITRA and MAYA doing the analytical heavy lifting and humans making key decisions.

### The case
**Product:** IT App X  
**Regulation:** DORA Art. 12(1)(c)  
**Requirement:** Backup geographic redundancy  
**Journey:** Change detected → Internal gap identified → Change approved → Non-compliant → Remediation in progress → Implemented → Verified → Evidence complete → Compliant

### Three activities

**Activity 1 — Define What Must Change (Compliance Hub)**
- Compliance Hub receives the regulatory change (EUR-Lex / DDCR feed).
- MITRA analyses internal policies, guidelines, standards and Control Activities.
- MITRA identifies the internal gap: Backup Policy does not mandate geographic distribution.
- MITRA proposes: Amend Backup Policy + add Control Activity BR0039-GR.
- Control Owner reviews and approves (human gate).

**Activity 2 — Fix What Must Change for the Product (Product Hub)**
- Product Hub receives the approved internal change.
- IT App X is marked Non-compliant.
- MAYA analyses the product's documentation and connected repositories.
- MAYA proposes: SDD § 4.2 update + Operating Manual § 7.1 update + IaC change.
- Product Team reviews in the migration view (human gate — all proposed changes visible).
- Human approval required before implementation.

**Activity 3 — Verify and Report the Result (Verification & DDCR)**
- SDD v2 approved, Operating Manual v2 approved.
- Technical policy checks: POL-BACKUP-001 Compliant, POL-BACKUP-002 Compliant.
- Evidence package compiled — all mandatory checks passed.
- DDCR transitions IT App X / DORA Art. 12(1)(c): Non-compliant → Compliant.
- History retained explaining why the status changed.

### Key rule
DDCR does not become Compliant because MITRA proposed a change or MAYA generated a document.
It becomes Compliant only after all documentary verification, technical verification,
and evidence are complete and no mandatory gate is open.

---

## Chapter 3 — North Star 2030

### Purpose
Show the destination — compliance increasingly built into products and platforms,
with people focusing on exceptions rather than standard cases.

### Structure
Three columns from left to right:

**LEFT — Continuous Regulatory Change**
Multiple regulatory sources (DORA, NIS2, GDPR, EU AI Act, Solvency II) stream
requirements continuously. The platform is source-agnostic.

**CENTRE — End-to-end Orchestration**
Compliance Hub (MITRA) interprets change and proposes policy/control updates.
Product Hub (MAYA) assesses product impact and proposes change sets.
Standard remediations flow automatically. Controls are applied by default.
An exception lane branches upward: risk acceptance, policy deviations, and
quality-critical decisions are routed to accountable people.

**RIGHT — Enterprise Visibility**
DDCR provides continuous portfolio-wide status.
Evidence and traceability are always linked.
The portfolio shows compliance across regulations, products and subsidiaries.

### The message
> "Compliance becomes increasingly built into products and platforms.
> Standard cases are handled continuously, while people focus on exceptions,
> risk decisions and quality."

### What the North Star does NOT show
- Current productive Munich Re capability.
- Implementation architecture, AI prompts or model mechanics.
- A specific delivery timeline or commitment.
