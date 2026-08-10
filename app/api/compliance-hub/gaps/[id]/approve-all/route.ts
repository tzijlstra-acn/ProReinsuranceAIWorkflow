import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import {
  complianceGaps,
  controlChanges,
  internalDocuments,
} from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { approveControlChange, publishControlChange } from '@/lib/domain/compliance-hub'

// Approves + publishes the DRAFT control change for a gap,
// and applies embedded document updates to internal_documents.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json() as { approvedBy?: string; action?: 'approve' | 'reject' }
    const { approvedBy = 'Reviewer', action = 'approve' } = body

    const gap = db.select().from(complianceGaps).where(eq(complianceGaps.id, id)).get()
    if (!gap) return NextResponse.json({ error: 'Gap not found' }, { status: 404 })

    if (action === 'reject') {
      // Close the gap and any draft control changes
      const draftChanges = db.select().from(controlChanges).all()
        .filter(c => c.gapId === id && c.status === 'DRAFT')
      for (const cc of draftChanges) {
        db.update(controlChanges)
          .set({ status: 'REJECTED' })
          .where(eq(controlChanges.id, cc.id))
          .run()
      }
      db.update(complianceGaps)
        .set({ status: 'OPEN' })
        .where(eq(complianceGaps.id, id))
        .run()
      return NextResponse.json({ ok: true, action: 'rejected' })
    }

    // Find the DRAFT control change for this gap
    const draftChange = db.select().from(controlChanges).all()
      .find(c => c.gapId === id && c.status === 'DRAFT')
    if (!draftChange) {
      return NextResponse.json({ error: 'No draft control change found — generate a proposal first' }, { status: 400 })
    }

    // Parse proposedChanges to extract documentUpdates
    let documentUpdates: Array<{
      documentId: string
      documentTitle: string
      proposedContent: string
      changeSummary: string
    }> = []

    try {
      const pc = JSON.parse(draftChange.proposedChanges ?? '{}') as Record<string, unknown>
      if (Array.isArray(pc.documentUpdates)) {
        documentUpdates = pc.documentUpdates as typeof documentUpdates
      }
    } catch { /* proposedChanges not parseable */ }

    // Approve → Publish the control change
    approveControlChange(draftChange.id, approvedBy)
    publishControlChange(draftChange.id)

    // Apply document content updates
    const docsApplied: string[] = []
    for (const update of documentUpdates) {
      const doc = db.select().from(internalDocuments).where(eq(internalDocuments.id, update.documentId)).get()
      if (!doc) continue

      db.update(internalDocuments)
        .set({
          content: update.proposedContent,
          status: 'published',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(internalDocuments.id, update.documentId))
        .run()
      docsApplied.push(update.documentId)
    }

    // Mark gap as CHANGE_PROPOSED (published)
    db.update(complianceGaps)
      .set({ status: 'CHANGE_PROPOSED' })
      .where(eq(complianceGaps.id, id))
      .run()

    return NextResponse.json({
      ok: true,
      action: 'approved',
      controlChangeId: draftChange.id,
      docsApplied,
    })
  } catch (err) {
    console.error('[Approve All]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
