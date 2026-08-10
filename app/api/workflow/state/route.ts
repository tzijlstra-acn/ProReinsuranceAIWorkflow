import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import {
  complianceGaps,
  controlChanges,
  remediationCases,
  products,
  regulatoryRequirements,
  regulatorySources,
  verificationResults,
  evidencePackages,
  ddcrReportingRecords,
} from '@/lib/db/schema'

export async function GET() {
  try {
    const allGaps = db.select().from(complianceGaps).all()
    const allChanges = db.select().from(controlChanges).all()
    const allCases = db.select().from(remediationCases).all()
    const allProducts = db.select().from(products).all()
    const allRequirements = db.select().from(regulatoryRequirements).all()
    const allSources = db.select().from(regulatorySources).all()
    const allVrResults = db.select().from(verificationResults).all()
    const allEvidencePkgs = db.select().from(evidencePackages).all()
    const allDdcrRecords = db.select().from(ddcrReportingRecords).all()

    // ── Compliance Team ───────────────────────────────────────────────────────

    const OPEN_GAP_STATUSES = new Set(['OPEN', 'IN_ANALYSIS', 'CHANGE_PROPOSED'])
    const openGaps = allGaps
      .filter(g => OPEN_GAP_STATUSES.has(g.status))
      .map(g => {
        const source = allSources.find(s => s.id === g.sourceId) ?? null
        const requirement = allRequirements.find(r => r.id === g.requirementId) ?? null
        const linked = allChanges.find(cc => cc.gapId === g.id) ?? null
        return {
          id: g.id,
          title: g.title,
          severity: g.severity,
          status: g.status,
          sourceId: g.sourceId,
          source: source ? { shortCode: source.shortCode } : null,
          requirement: requirement
            ? { articleRef: requirement.articleRef, title: requirement.title }
            : null,
          linkedControlChange: linked
            ? { id: linked.id, status: linked.status, title: linked.title }
            : null,
        }
      })

    const EXCLUDED_CHANGE_STATUSES = new Set(['PUBLISHED', 'REJECTED'])
    const pendingChanges = allChanges
      .filter(cc => !EXCLUDED_CHANGE_STATUSES.has(cc.status))
      .map(cc => ({
        id: cc.id,
        title: cc.title,
        status: cc.status,
        changeType: cc.changeType,
        gapId: cc.gapId,
        requirementId: cc.requirementId,
        aiGenerated: cc.aiGenerated,
        proposedAt: cc.proposedAt,
        approvedAt: cc.approvedAt,
      }))

    // ── Product Team ──────────────────────────────────────────────────────────

    const ACTIVE_CASE_STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'BLOCKED'])
    const activeCases = allCases
      .filter(c => ACTIVE_CASE_STATUSES.has(c.status))
      .map(c => {
        const product = allProducts.find(p => p.id === c.productId) ?? null
        const requirement = allRequirements.find(r => r.id === c.requirementId) ?? null
        const source = allSources.find(s => s.id === c.sourceId) ?? null
        return {
          id: c.id,
          title: c.title,
          status: c.status,
          priority: c.priority,
          assignedTo: c.assignedTo,
          dueDate: c.dueDate,
          productId: c.productId,
          requirementId: c.requirementId,
          product: product ? { name: product.name, criticality: product.criticality } : null,
          requirement: requirement
            ? { articleRef: requirement.articleRef, title: requirement.title }
            : null,
          source: source ? { shortCode: source.shortCode } : null,
        }
      })

    // ── DDCR Team ─────────────────────────────────────────────────────────────

    const DDCR_PENDING_STATUSES = new Set(['PENDING', 'NON_COMPLIANT'])
    const pendingDdcrRecords = allDdcrRecords.filter(
      r => DDCR_PENDING_STATUSES.has(r.status) && r.requirementId !== null
    )

    const pendingProducts = pendingDdcrRecords.map(r => {
      const product = allProducts.find(p => p.id === r.productId) ?? null
      const requirement = allRequirements.find(req => req.id === r.requirementId) ?? null
      const source = allSources.find(s => s.id === r.sourceId) ?? null

      const latestEp = allEvidencePkgs
        .filter(ep => ep.productId === r.productId && ep.requirementId === r.requirementId)
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0] ?? null

      const latestVr = allVrResults
        .filter(vr => vr.productId === r.productId && vr.requirementId === r.requirementId)
        .sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt))[0] ?? null

      return {
        productId: r.productId,
        productName: product?.name ?? r.productId,
        requirementId: r.requirementId,
        requirementTitle: requirement?.title ?? r.requirementId ?? '',
        sourceShortCode: source?.shortCode ?? r.sourceId ?? '',
        evidencePackageStatus: latestEp?.status ?? null,
        latestVerificationStatus: latestVr?.status ?? null,
        ddcrStatus: r.status,
        sourceId: r.sourceId,
      }
    })

    const compliantCount = allDdcrRecords.filter(
      r => r.status === 'COMPLIANT' && r.requirementId === null && r.sourceId === null
    ).length

    return NextResponse.json({
      complianceTeam: { openGaps, controlChanges: pendingChanges },
      productTeam: { activeCases },
      ddcrTeam: { pendingProducts, compliantCount },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
