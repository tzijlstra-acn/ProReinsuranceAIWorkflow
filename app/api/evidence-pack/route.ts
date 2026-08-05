import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import {
  regulationSources,
  guidelineVersions,
  controlActivities,
  iacChanges,
  deployments,
  complianceWorkProducts,
  documentVersions,
  documents,
  auditEvents,
  approvals,
} from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getCurrentState } from '@/lib/state-machine'
import { getLatestPolicyEvaluations } from '@/lib/policy-engine'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const documentId = searchParams.get('documentId')

    if (documentId) {
      return getDocumentEvidencePack(documentId)
    }

    return getFullEvidencePack()
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ── Full evidence pack (existing behaviour) ────────────────────────────────

async function getFullEvidencePack() {
  const { state, correlationId } = await getCurrentState()

  const regulation = db.select().from(regulationSources).where(eq(regulationSources.id, 'DORA-ART-12')).get()
  const guidelineVers = db.select().from(guidelineVersions).all()
  const controls = db.select().from(controlActivities).all()
  const latestIac = db.select().from(iacChanges).orderBy(desc(iacChanges.createdAt)).limit(1).get()
  const latestDeployment = db.select().from(deployments).orderBy(desc(deployments.simulatedAt)).limit(1).get()
  const policyEvals = getLatestPolicyEvaluations('APP-X-001')
  const workProducts = db.select().from(complianceWorkProducts).where(eq(complianceWorkProducts.applicationId, 'APP-X-001')).all()
  const docVersions = db.select().from(documentVersions).all()
  const recentEvents = db.select().from(auditEvents).orderBy(desc(auditEvents.timestamp)).limit(50).all()

  const pack = {
    exportedAt: new Date().toISOString(),
    demoState: state,
    correlationId,
    disclaimer: 'SYNTHETIC DEMONSTRATION DATA — No client data. All entities are fictional.',
    regulation: regulation ? JSON.parse(regulation.fixture) : null,
    guidelines: guidelineVers,
    controlActivities: controls,
    iacChange: latestIac,
    deployment: latestDeployment
      ? { ...latestDeployment, cloudStateSnapshot: JSON.parse(latestDeployment.cloudStateSnapshot || '{}') }
      : null,
    policyEvaluations: policyEvals.map(e => ({ ...e, evidence: JSON.parse(e.evidence || '{}') })),
    ddcrWorkProducts: workProducts.map(w => ({ ...w, evidenceIds: JSON.parse(w.evidenceIds || '[]') })),
    documentVersions: docVersions,
    auditEvents: recentEvents.map(e => ({ ...e, metadata: JSON.parse(e.metadata || '{}') })),
  }

  const markdown = generateFullMarkdown(pack)
  return NextResponse.json({ json: pack, markdown })
}

// ── Document-scoped evidence pack ─────────────────────────────────────────

async function getDocumentEvidencePack(documentId: string) {
  const doc = db.select().from(documents).where(eq(documents.id, documentId)).get()
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const { correlationId } = await getCurrentState()

  const versions = db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .all()
    .sort((a, b) => (b.createdAt ?? '') > (a.createdAt ?? '') ? 1 : -1)

  // Approvals for any version of this document
  const allApprovals = db.select().from(approvals).all()
  const docApprovals = allApprovals.filter(
    a => a.objectId === documentId || versions.some(v => v.id === a.objectId || v.approvalId === a.id),
  )
  const latestApproval = docApprovals.sort((a, b) => (b.decidedAt ?? '') > (a.decidedAt ?? '') ? 1 : -1)[0]

  // Policy evaluations
  const policyEvals = getLatestPolicyEvaluations('APP-X-001')

  // Latest deployment
  const latestDeployment = db
    .select()
    .from(deployments)
    .orderBy(desc(deployments.simulatedAt))
    .limit(1)
    .get()

  // Audit events related to this document or the correlation ID
  const recentAudit = db.select().from(auditEvents).orderBy(desc(auditEvents.timestamp)).limit(200).all()
  const relatedAudit = recentAudit.filter(
    e =>
      e.objectId === documentId ||
      versions.some(v => e.objectId === v.id) ||
      e.correlationId === correlationId,
  )

  const versionRows = versions.map(v => ({
    version: v.version,
    status: v.status,
    content: v.content,
    createdAt: v.createdAt,
    ...(v.status === 'approved' && {
      approvedAt: v.createdAt,
      approvedBy: latestApproval?.reviewerName ?? 'IT Risk & Compliance Lead',
    }),
  }))

  const pack = {
    generatedAt: new Date().toISOString(),
    documentId: doc.id,
    documentTitle: doc.title,
    disclaimer: 'SYNTHETIC DEMONSTRATION DATA — No client data. All entities are fictional.',
    versions: versionRows,
    linkedEvidence: {
      policyEvaluations: policyEvals.map(e => ({ ...e, evidence: JSON.parse(e.evidence || '{}') })),
      deployment: latestDeployment
        ? { ...latestDeployment, cloudStateSnapshot: JSON.parse(latestDeployment.cloudStateSnapshot || '{}') }
        : null,
      approvalRecord: latestApproval ?? null,
    },
    auditTrail: relatedAudit.map(e => ({ ...e, metadata: JSON.parse(e.metadata || '{}') })),
    markdown: generateDocumentMarkdown(doc.title, versionRows, latestApproval),
  }

  return NextResponse.json(pack)
}

// ── Markdown generators ────────────────────────────────────────────────────

function generateDocumentMarkdown(
  title: string,
  versions: Array<{ version: string; status: string; createdAt?: string | null; approvedBy?: string }>,
  latestApproval: { reviewerName: string; decision: string; decidedAt?: string | null; reviewerComment?: string | null } | undefined,
): string {
  const date = new Date().toISOString()
  const versionsSection = versions
    .map(
      v =>
        `### v${v.version} — ${v.status}\n` +
        `Created: ${v.createdAt ?? 'unknown'}\n` +
        (v.approvedBy ? `Approved by: ${v.approvedBy}\n` : ''),
    )
    .join('\n')

  const approvalSection = latestApproval
    ? `## Approval Record\n- Decision: **${latestApproval.decision}**\n- Reviewer: ${latestApproval.reviewerName}\n- Date: ${latestApproval.decidedAt ?? 'unknown'}\n- Comment: ${latestApproval.reviewerComment ?? '—'}`
    : '## Approval Record\nNo approval on record.'

  return `# Document Evidence Pack
## Document: ${title}
## Generated: ${date}

> SYNTHETIC DEMONSTRATION DATA — No client data. All entities are fictional.

---

## Version History
${versionsSection}

---

${approvalSection}

---

*End of document evidence pack — ${date}*`
}

function generateFullMarkdown(pack: Record<string, unknown>): string {
  return `# AoC Control Line — Evidence Pack
## Export Date: ${pack.exportedAt}
## Demo State: ${pack.demoState}
## Correlation ID: ${pack.correlationId}

> **${pack.disclaimer}**

---

## 1. Regulatory Obligation
**DORA Article 12** — Backup policies and procedures, restoration and recovery procedures and methods
Source: EUR-Lex (https://eur-lex.europa.eu/eli/reg/2022/2554/oj/eng)

---

## 2. Approved Guideline
**BR Guideline v3.3** — Geographic Redundancy (GRZ) requirement added

---

## 3. Control Activity
**BR0039-GR [DEMO DATA]** — Backup Geographic Redundancy Verification
Automated test: POL-BACKUP-001 + POL-BACKUP-002 both Compliant

---

## 4. Policy Evidence
- **POL-BACKUP-001 (VM Backup Enabled):** Compliant
- **POL-BACKUP-002 (Backup Storage Geo-Redundant):** Compliant

---

## 5. DDCR Status
- Backup Job Configuration: Fulfilled

---

*End of evidence pack — ${pack.exportedAt}*`
}
