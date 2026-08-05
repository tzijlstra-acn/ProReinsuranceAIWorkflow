import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { regulationSources, requirements, guidelines, guidelineVersions, controlActivities, iacChanges, deployments, policyEvaluations, complianceWorkProducts, documents, documentVersions } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getLatestPolicyEvaluations } from '@/lib/policy-engine'
import { getCurrentState } from '@/lib/state-machine'

export async function GET() {
  try {
    const { state } = await getCurrentState()

    const regulation = db.select().from(regulationSources).where(eq(regulationSources.id, 'DORA-ART-12')).get()
    const reqs = db.select().from(requirements).where(eq(requirements.regulationSourceId, 'DORA-ART-12')).all()
    const guideline = db.select().from(guidelines).where(eq(guidelines.id, 'GL-BR-001')).get()
    const gvActive = db.select().from(guidelineVersions).where(eq(guidelineVersions.guidelineId, 'GL-BR-001')).all()
    const control = db.select().from(controlActivities).where(eq(controlActivities.id, 'CA-BR0039-GR')).get()
    const latestIac = db.select().from(iacChanges).orderBy(desc(iacChanges.createdAt)).limit(1).get()
    const latestDeployment = db.select().from(deployments).where(eq(deployments.applicationId, 'APP-X-001')).orderBy(desc(deployments.simulatedAt)).limit(1).get()
    const policyEvals = getLatestPolicyEvaluations('APP-X-001')
    const workProducts = db.select().from(complianceWorkProducts).where(eq(complianceWorkProducts.applicationId, 'APP-X-001')).all()
    const docs = db.select().from(documents).where(eq(documents.applicationId, 'APP-X-001')).all()
    const docVersions = db.select().from(documentVersions).all()

    return NextResponse.json({
      demoState: state,
      chain: [
        {
          stage: 1,
          label: 'Regulatory Obligation',
          entity: 'DORA Article 12',
          type: 'regulation',
          data: { ...regulation, fixture: regulation ? JSON.parse(regulation.fixture) : null, requirements: reqs },
          status: 'complete',
        },
        {
          stage: 1,
          label: 'Guideline Update',
          entity: 'BR Guideline v3.3',
          type: 'guideline',
          data: { guideline, versions: gvActive },
          status: ['STANDARD_APPROVED','IAC_PR_CREATED','DEPLOYMENT_APPROVED','DEPLOYED','POLICY_VERIFIED','DDCR_UPDATED','DOCS_PROPOSED','DOCS_APPROVED','EVIDENCE_READY'].includes(state) ? 'complete' : 'pending',
        },
        {
          stage: 1,
          label: 'Control Activity',
          entity: 'BR0039-GR [DEMO DATA]',
          type: 'control',
          data: control,
          status: ['STANDARD_APPROVED','IAC_PR_CREATED','DEPLOYMENT_APPROVED','DEPLOYED','POLICY_VERIFIED','DDCR_UPDATED','DOCS_PROPOSED','DOCS_APPROVED','EVIDENCE_READY'].includes(state) ? 'complete' : 'pending',
        },
        {
          stage: 2,
          label: 'IaC Change',
          entity: latestIac ? `${latestIac.prNumber} (${latestIac.commitSha})` : 'Not generated',
          type: 'iac',
          data: latestIac,
          status: latestIac ? 'complete' : 'pending',
        },
        {
          stage: 2,
          label: 'Simulated Deployment',
          entity: latestDeployment ? `${latestDeployment.status}` : 'Not deployed',
          type: 'deployment',
          data: latestDeployment ? { ...latestDeployment, cloudStateSnapshot: JSON.parse(latestDeployment.cloudStateSnapshot || '{}') } : null,
          status: latestDeployment?.status === 'succeeded' ? 'complete' : 'pending',
        },
        {
          stage: 3,
          label: 'Policy Verification',
          entity: 'POL-BACKUP-001 + POL-BACKUP-002',
          type: 'policy',
          data: policyEvals.map(e => ({ ...e, evidence: JSON.parse(e.evidence || '{}') })),
          status: policyEvals.some(e => e.policyCode === 'POL-BACKUP-001' && e.status === 'Compliant') ? 'complete' : 'pending',
        },
        {
          stage: 4,
          label: 'DDCR Report',
          entity: 'Backup Job Configuration',
          type: 'ddcr',
          data: workProducts.map(w => ({ ...w, evidenceIds: JSON.parse(w.evidenceIds || '[]') })),
          status: workProducts.find(w => w.name === 'Backup Job Configuration')?.status === 'Fulfilled' ? 'complete' : 'pending',
        },
        {
          stage: 5,
          label: 'Documentation',
          entity: 'SDD v2.5 + OM v1.9',
          type: 'document',
          data: docs.map(d => ({ ...d, versions: docVersions.filter(v => v.documentId === d.id) })),
          status: ['DOCS_APPROVED','EVIDENCE_READY'].includes(state) ? 'complete' : 'pending',
        },
        {
          stage: 6,
          label: 'Audit Evidence',
          entity: 'RQMT Answer',
          type: 'audit',
          data: null,
          status: state === 'EVIDENCE_READY' ? 'complete' : 'pending',
        },
      ],
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
