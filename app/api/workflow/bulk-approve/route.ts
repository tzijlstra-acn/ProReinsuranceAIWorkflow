import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import {
  complianceGaps,
  controlChanges,
  regulatoryRequirements,
  regulatorySources,
  productApplicability,
  remediationCases,
} from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAiProvider } from '@/lib/ai/provider'
import { approveControlChange, publishControlChange } from '@/lib/domain/compliance-hub'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { approvedBy?: string }
    const approvedBy = body.approvedBy?.trim() || 'Bulk Approver'

    const ai = getAiProvider()
    let generated = 0
    let approved = 0
    let published = 0
    let casesCreated = 0

    // ── Step 1: Generate AI control changes for OPEN gaps with no change yet ─
    const openGaps = db.select().from(complianceGaps).where(eq(complianceGaps.status, 'OPEN')).all()
    const existingChanges = db.select().from(controlChanges).all()
    const gapsAlreadyCovered = new Set(existingChanges.map(c => c.gapId))
    const gapsNeedingChanges = openGaps.filter(g => !gapsAlreadyCovered.has(g.id))

    for (const gap of gapsNeedingChanges) {
      const requirement = db.select().from(regulatoryRequirements)
        .where(eq(regulatoryRequirements.id, gap.requirementId)).get()
      const source = db.select().from(regulatorySources)
        .where(eq(regulatorySources.id, gap.sourceId)).get()
      if (!requirement || !source) continue

      try {
        const proposal = await ai.generateControlChange(
          {
            title: gap.title,
            description: gap.description,
            severity: gap.severity,
            gapType: gap.gapType,
            aiAnalysis: gap.aiAnalysis,
          },
          {
            articleRef: requirement.articleRef,
            title: requirement.title,
            description: requirement.description,
            obligationType: requirement.obligationType,
          },
          source.shortCode
        )

        const now = new Date().toISOString()
        db.insert(controlChanges).values({
          id: `CC-BULK-${Date.now()}-${generated}`,
          gapId: gap.id,
          requirementId: gap.requirementId,
          title: proposal.title,
          description: proposal.description,
          changeType: proposal.changeType,
          status: 'DRAFT',
          proposedAt: now,
          proposedChanges: JSON.stringify(proposal.proposedChanges),
          aiGenerated: true,
        }).run()

        db.update(complianceGaps)
          .set({ status: 'IN_ANALYSIS' })
          .where(eq(complianceGaps.id, gap.id))
          .run()

        generated++
      } catch {
        // skip individual AI failures
      }
    }

    // ── Step 2: Approve all DRAFT / PROPOSED / UNDER_REVIEW changes ──────────
    const pendingChanges = db.select().from(controlChanges).all()
      .filter(c => ['DRAFT', 'PROPOSED', 'UNDER_REVIEW'].includes(c.status))

    for (const cc of pendingChanges) {
      try {
        approveControlChange(cc.id, approvedBy)
        approved++
      } catch {
        // skip
      }
    }

    // ── Step 3: Publish all APPROVED changes ─────────────────────────────────
    const approvedChanges = db.select().from(controlChanges).all()
      .filter(c => c.status === 'APPROVED')

    for (const cc of approvedChanges) {
      try {
        publishControlChange(cc.id)
        published++
      } catch {
        // skip
      }
    }

    // ── Step 4: Auto-create remediation cases for applicable products ─────────
    const publishedChanges = db.select().from(controlChanges).all()
      .filter(c => c.status === 'PUBLISHED')

    const existingCases = db.select().from(remediationCases).all()
    const activeKeys = new Set(
      existingCases
        .filter(c => ['OPEN', 'IN_PROGRESS', 'BLOCKED'].includes(c.status))
        .map(c => `${c.productId}::${c.requirementId}`)
    )

    for (const cc of publishedChanges) {
      const gap = db.select().from(complianceGaps)
        .where(eq(complianceGaps.id, cc.gapId)).get()
      if (!gap) continue

      const applicableProducts = db.select().from(productApplicability)
        .where(eq(productApplicability.requirementId, cc.requirementId))
        .all()
        .filter(a => a.applicable)

      for (const pa of applicableProducts) {
        const key = `${pa.productId}::${pa.requirementId}`
        if (activeKeys.has(key)) continue

        try {
          const priority = gap.severity === 'CRITICAL' || gap.severity === 'HIGH' ? 'HIGH' : 'MEDIUM'
          db.insert(remediationCases).values({
            id: `RC-BULK-${Date.now()}-${casesCreated}`,
            productId: pa.productId,
            requirementId: pa.requirementId,
            sourceId: gap.sourceId,
            title: `Remediation: ${cc.title}`,
            description: `Auto-created from published control change ${cc.id}`,
            status: 'OPEN',
            priority,
            assignedTo: null,
            dueDate: null,
            productGapIds: '[]',
          }).run()
          activeKeys.add(key)
          casesCreated++
        } catch {
          // skip
        }
      }
    }

    return NextResponse.json({ ok: true, generated, approved, published, casesCreated })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
