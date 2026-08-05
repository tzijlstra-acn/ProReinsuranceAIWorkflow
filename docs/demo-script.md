# AoC Control Line — Board Demo Script

**Duration:** 5–7 minutes  
**Audience:** Senior stakeholders, board-level or C-suite  
**Presenter notes:** Text in *italics* is guidance for the presenter, not spoken aloud.

---

## Opening (30 seconds)

"What you're about to see is a compliance workflow that normally takes weeks, completed in minutes."

"A new DORA Article 12 requirement has arrived — regulators now mandate that backup storage for critical financial applications must be geo-redundant, not just locally redundant. In the traditional world, that triggers a chain: a policy analyst reads the regulation, a controls team rewrites the guideline, an engineer raises a change request, a deployment team reconfigures infrastructure, a compliance team updates the DDCR, a documentation team revises the SDD and Operating Manual, and an audit team compiles evidence. Each handoff takes days."

"This tool compresses all of that into a single workflow where AI handles every drafting and configuration task, and humans approve at every gate."

*Open the application at http://localhost:3000. The screen shows Stage 0: Baseline — Non-Compliant. The APP-X-001 tile shows the RecoveryVault using LocallyRedundant storage.*

---

## Stage 1: Regulation → Standard (60–90 seconds)

"We start at the baseline. APP-X-001 is non-compliant. The Recovery Vault is locally redundant. There is no control activity covering geo-redundancy. The DDCR shows 'Not Fulfilled'."

"Click 'Analyse Regulation'. The AI reads DORA Article 12 and identifies the gap."

*Click the 'Analyse Regulation' button. A progress indicator appears.*

"It is proposing two changes simultaneously: an update to our internal BR Guideline — from version 3.2 to 3.3 — adding the geo-redundancy requirement, and a brand-new control activity, BR0039-GR, which will sit alongside the existing BR0039 backup control."

*The proposal panel appears showing the guideline diff and the new control activity card marked [DEMO DATA].*

"Notice two things. First, the AI has written the control objective, scope, frequency, and evidence requirements in our existing house style — it has followed the pattern from BR0039. Second, the [DEMO DATA] label is explicit. In a production system this would be unmarked; we are transparent here that it is illustrative."

"This is the first human gate. As the Chief Risk Officer, you are looking at this proposal right now. Click 'Approve' to proceed, or 'Reject' to send it back."

*Click 'Approve'.*

"Approved. Stage 1 complete. The guideline is now at version 3.3, pending. The control activity is raised."

---

## Stage 2: IaC Change and Deployment (60–90 seconds)

"Stage 2. We need the infrastructure to actually change. In the traditional world an engineer writes a Terraform diff, raises a PR, waits for review, waits for deployment. Here the AI generates the IaC automatically."

*Click 'Generate IaC'. A Terraform diff appears in the IaC panel.*

"Read the diff with me. It is creating a new Recovery Vault with storageRedundancy set to GeoRedundant, creating a Backup Policy attached to it, and registering the existing virtual machine as a protected item. That is the exact set of resources the control activity BR0039-GR requires."

"This is the second human gate. The infrastructure change goes nowhere without explicit approval. Click 'Approve PR and Deploy'."

*Click 'Approve PR and Deploy'. A simulated deployment log scrolls briefly.*

"The deployment is simulated — no real Azure subscription is touched. What the system has done is written the post-deployment cloud state into the database, exactly as Azure Resource Manager would return it. That state is what the policy engine will evaluate next."

---

## Stage 3: Policy Evaluation (30–45 seconds)

"Stage 3. Automated policy evaluation. No human action required here — watch the status change."

*The policy results panel updates automatically. POL-BACKUP-001 and POL-BACKUP-002 flip from NonCompliant (red) to Compliant (green).*

"Before the deployment: both policies non-compliant. After: both compliant. The policy engine has checked for the presence of a RecoveryVault, a BackupProtectedItem, and confirmed the storageRedundancy is GeoRedundant. It has written the evidence — the exact resource IDs and configuration values — into the audit trail."

"POL-EDR-001 remains non-compliant. That is intentional — we are demonstrating that not all gaps are addressed by this change. Scope matters."

---

## Stage 4: DDCR Update (20–30 seconds)

"Stage 4. The DDCR. Normally a compliance analyst logs into the GRC system and manually ticks the 'Backup Job Configuration' work product as fulfilled. That step is eliminated."

*The DDCR panel updates. 'Backup Job Configuration' flips from 'Not Fulfilled' to 'Fulfilled'. The evidence IDs appear automatically.*

"The DDCR adapter has read the policy evaluation results, confirmed both backup policies are now Compliant, and derived the work product status. The evidence IDs are the UUIDs of the two policy evaluation records. No human touched this — and no human could have made it say 'Fulfilled' unless the underlying policies had passed."

---

## Stage 5: Documentation (45–60 seconds)

"Stage 5. The SDD and Operating Manual need to reflect the new control. Click 'Generate Documentation'."

*Click 'Generate Documentation'. Two document sections appear: an SDD update and an Operating Manual paragraph.*

"The AI has written this in the existing document style. It references BR0039-GR by its correct code, describes the geo-redundant vault configuration, and sets the review frequency to quarterly — consistent with the control activity definition."

"Third human gate. Your Head of Technology reviews this. Click 'Approve Documentation'."

*Click 'Approve Documentation'.*

"Approved. The document version is incremented and locked."

---

## Stage 6: Evidence Ready (30–45 seconds)

"Final stage. An auditor asks: 'How does your organisation satisfy DORA Article 12 on backup geo-redundancy for APP-X-001?'"

*Click 'Show Evidence Chain'. A graph or list appears: Regulation → Guideline v3.3 → Control BR0039-GR → IaC Change → Deployment → PolicyEvaluation (POL-BACKUP-001) → PolicyEvaluation (POL-BACKUP-002) → ComplianceWorkProduct (Fulfilled) → DocumentVersion.*

"That question — which might have taken a compliance team two days to compile manually — is answered in seconds. Every node in that chain has a timestamp, an actor, and an immutable audit event. The evidence package is ready for the regulator."

---

## Closing (30–45 seconds)

"What you have just seen is a single compliance chain for a single application. In practice, a regulatory change touches multiple guidelines, multiple control activities, and tens or hundreds of applications."

"We estimate a single change chain of this type — one regulation, one application, one audit question — takes approximately 74 person-hours manually: 32 hours to read the regulation and update the standard, 30 hours of engineering and deployment work, 12 hours of audit evidence preparation."

"With AI assistance, that same chain takes approximately 17 hours — the time humans spend reviewing and approving, not drafting. That is a 77% reduction. Across a portfolio of 10 regulatory changes touching 25 applications, the annual saving is several thousand hours."

"Three things did not change in this demo: the human approval gates, the audit trail, and the policy logic. The AI drafted; humans decided. That is the principle."

*Click 'Run End-to-End' to replay the full workflow automatically, pausing at each approval gate, if a hands-off demonstration is preferred.*

---

## Handling Questions

**"Is this connected to our actual systems?"**
No. This is a self-contained demonstrator using synthetic data. Nothing is connected to a real Azure subscription, a real DDCR, or a real GRC platform. Those integrations are the implementation work.

**"Which AI model is this?"**
In offline mode, all AI outputs are pre-scripted. In live mode, o3 handles the regulation analysis, gpt-4o generates the Terraform, and gpt-4o-mini drafts the documentation.

**"Can the AI approve its own proposals?"**
No. The approval gates are enforced by the state machine. The system cannot advance from STANDARD_PROPOSED to STANDARD_APPROVED without a human action — there is no API call or automated pathway that bypasses it.

**"What about the 77% figure — is that based on our data?"**
The hour assumptions are illustrative and based on workshop estimates. We can replace them with actuals from a time-and-motion study against your current process.
