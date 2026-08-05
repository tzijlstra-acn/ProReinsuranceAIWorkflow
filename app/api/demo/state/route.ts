import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { demoRuns, auditEvents, guidelineVersions, controlActivities, iacChanges, deployments, policyEvaluations, complianceWorkProducts, documentVersions, documents } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getCurrentState, getStageForState, getStateLabel, getAllowedTransitions } from '@/lib/state-machine'

export async function GET() {
  try {
    const { state, correlationId, runId } = await getCurrentState()

    // Recent audit events (last 20)
    const recentEvents = db.select().from(auditEvents)
      .orderBy(desc(auditEvents.timestamp))
      .limit(20)
      .all()

    // Guideline versions
    const gvs = db.select().from(guidelineVersions).all()

    // Control activities
    const cas = db.select().from(controlActivities).all()

    // Latest IaC change
    const latestIac = db.select().from(iacChanges).orderBy(desc(iacChanges.createdAt)).limit(1).get()

    // Latest deployment
    const latestDeployment = db.select().from(deployments).orderBy(desc(deployments.simulatedAt)).limit(1).get()

    // Policy evaluations (latest per policy)
    const allEvals = db.select().from(policyEvaluations)
      .where(eq(policyEvaluations.applicationId, 'APP-X-001'))
      .orderBy(desc(policyEvaluations.evaluatedAt))
      .all()

    const latestEvalMap = new Map<string, typeof allEvals[0]>()
    for (const e of allEvals) {
      if (!latestEvalMap.has(e.policyCode)) latestEvalMap.set(e.policyCode, e)
    }

    // Work products
    const workProducts = db.select().from(complianceWorkProducts)
      .where(eq(complianceWorkProducts.applicationId, 'APP-X-001'))
      .all()

    // Documents + versions
    const docs = db.select().from(documents)
      .where(eq(documents.applicationId, 'APP-X-001'))
      .all()
    const docVersions = db.select().from(documentVersions).all()

    return NextResponse.json({
      runId,
      state,
      stageNumber: getStageForState(state),
      stateLabel: getStateLabel(state),
      allowedTransitions: getAllowedTransitions(state),
      correlationId,
      recentAuditEvents: recentEvents.map(e => ({
        ...e,
        metadata: JSON.parse(e.metadata || '{}'),
      })),
      guidelineVersions: gvs,
      controlActivities: cas,
      latestIacChange: latestIac,
      latestDeployment: latestDeployment ? {
        ...latestDeployment,
        cloudStateSnapshot: JSON.parse(latestDeployment.cloudStateSnapshot || '{}'),
      } : null,
      policyEvaluations: Array.from(latestEvalMap.values()).map(e => ({
        ...e,
        evidence: JSON.parse(e.evidence || '{}'),
      })),
      workProducts: workProducts.map(wp => ({
        ...wp,
        evidenceIds: JSON.parse(wp.evidenceIds || '[]'),
      })),
      documents: docs.map(d => ({
        ...d,
        versions: docVersions.filter(v => v.documentId === d.id),
      })),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
