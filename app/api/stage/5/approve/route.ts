import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { documentVersions, approvals, auditEvents, evidenceArtifacts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { transition, getCurrentState } from '@/lib/state-machine'
import { randomUUID } from 'crypto'
import {
  Paths,
  hashFile,
  appendTransformLog,
} from '@/lib/fs-service'
import { createSddV2Docx, createOmV2Docx } from '@/lib/docx-service'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { decision: 'approved' | 'rejected'; reviewerComment?: string; reviewerName?: string }
    const { decision, reviewerComment = '', reviewerName = 'IT Risk & Compliance Lead' } = body

    const { state, correlationId } = await getCurrentState()
    if (state !== 'DOCS_PROPOSED') {
      return NextResponse.json({ error: `Cannot approve docs in state ${state}` }, { status: 400 })
    }

    const allVersions = db.select().from(documentVersions).all()
    const proposedSdd = allVersions.find(v => v.documentId === 'DOC-SDD-001' && v.status === 'proposed')
    const proposedOm = allVersions.find(v => v.documentId === 'DOC-OM-001' && v.status === 'proposed')

    const approvalId = randomUUID()
    db.insert(approvals).values({
      id: approvalId,
      objectType: 'DocumentVersion',
      objectId: proposedSdd?.id ?? 'DOC-SDD-001',
      objectVersion: '2.5',
      decision,
      reviewerComment,
      reviewerName,
      correlationId,
    }).run()

    if (decision === 'approved') {
      const timestamp = new Date().toISOString()

      // ── File-system work: create DOCX files ─────────────────────────────

      const sddContent = proposedSdd?.proposedContent ?? proposedSdd?.content ?? ''
      const omContent = proposedOm?.proposedContent ?? proposedOm?.content ?? ''

      // Create physical DOCX files
      await createSddV2Docx(Paths.generated.sddV2, sddContent)
      await createOmV2Docx(Paths.generated.omV2, omContent)

      const sddV2Hash = hashFile(Paths.generated.sddV2)
      const omV2Hash = hashFile(Paths.generated.omV2)
      const sddV1Hash = hashFile(Paths.raw.sddV1)
      const omV1Hash = hashFile(Paths.raw.omV1)

      // Append transform log entries
      appendTransformLog({
        timestamp,
        transformationId: randomUUID(),
        sourceSystem: 'Product Hub (raw)',
        sourceFile: Paths.raw.sddV1,
        sourceVersion: 'v1.4',
        sourceHash: sddV1Hash,
        targetFile: Paths.generated.sddV2,
        targetVersion: 'v1.5',
        targetHash: sddV2Hash,
        operation: 'DOC_APPROVE',
        actor: reviewerName,
        approvalId,
        correlationId,
      })

      appendTransformLog({
        timestamp,
        transformationId: randomUUID(),
        sourceSystem: 'Product Hub (raw)',
        sourceFile: Paths.raw.omV1,
        sourceVersion: 'v1.1',
        sourceHash: omV1Hash,
        targetFile: Paths.generated.omV2,
        targetVersion: 'v1.2',
        targetHash: omV2Hash,
        operation: 'DOC_APPROVE',
        actor: reviewerName,
        approvalId,
        correlationId,
      })

      // ── DB work ────────────────────────────────────────────────────────
      if (proposedSdd) {
        db.update(documentVersions)
          .set({ status: 'approved', approvalId, content: proposedSdd.proposedContent ?? proposedSdd.content })
          .where(eq(documentVersions.id, proposedSdd.id))
          .run()
        const oldActive = allVersions.find(v => v.documentId === 'DOC-SDD-001' && v.status === 'active')
        if (oldActive) {
          db.update(documentVersions).set({ status: 'superseded' }).where(eq(documentVersions.id, oldActive.id)).run()
        }
      }
      if (proposedOm) {
        db.update(documentVersions)
          .set({ status: 'approved', approvalId, content: proposedOm.proposedContent ?? proposedOm.content })
          .where(eq(documentVersions.id, proposedOm.id))
          .run()
        const oldActive = allVersions.find(v => v.documentId === 'DOC-OM-001' && v.status === 'active')
        if (oldActive) {
          db.update(documentVersions).set({ status: 'superseded' }).where(eq(documentVersions.id, oldActive.id)).run()
        }
      }

      const sddArtifactId = randomUUID()
      const omArtifactId = randomUUID()

      db.insert(evidenceArtifacts).values([
        {
          id: sddArtifactId,
          type: 'DocumentVersion',
          sourceId: proposedSdd?.id ?? 'DOC-SDD-001',
          sourceType: 'DocumentVersion',
          content: JSON.stringify({
            documentId: 'DOC-SDD-001',
            version: '2.5',
            status: 'approved',
            generatedFile: Paths.generated.sddV2,
            fileHash: sddV2Hash,
          }),
          correlationId,
        },
        {
          id: omArtifactId,
          type: 'DocumentVersion',
          sourceId: proposedOm?.id ?? 'DOC-OM-001',
          sourceType: 'DocumentVersion',
          content: JSON.stringify({
            documentId: 'DOC-OM-001',
            version: '1.9',
            status: 'approved',
            generatedFile: Paths.generated.omV2,
            fileHash: omV2Hash,
          }),
          correlationId,
        },
      ]).run()

      db.insert(auditEvents).values({
        id: randomUUID(),
        actor: reviewerName,
        action: 'DOCS_APPROVED',
        objectType: 'DocumentVersion',
        objectId: proposedSdd?.id ?? 'DOC-SDD-001',
        outcome: 'success',
        correlationId,
        metadata: JSON.stringify({
          approvalId,
          reviewerComment,
          sddV2File: Paths.generated.sddV2,
          sddV2Hash,
          omV2File: Paths.generated.omV2,
          omV2Hash,
        }),
      }).run()

      const tx1 = await transition('DOCS_APPROVED', reviewerName)
      if (!tx1.ok) return NextResponse.json({ error: tx1.error }, { status: 400 })

      const tx2 = await transition('EVIDENCE_READY', 'system:evidence-compiler')
      return NextResponse.json({
        ok: true,
        newState: tx2.ok ? tx2.newState : 'DOCS_APPROVED',
        approvalId,
        files: {
          sddV2: Paths.generated.sddV2,
          sddV2Hash,
          omV2: Paths.generated.omV2,
          omV2Hash,
        },
      })
    } else {
      db.insert(auditEvents).values({
        id: randomUUID(),
        actor: reviewerName,
        action: 'DOCS_REJECTED',
        objectType: 'DocumentVersion',
        objectId: proposedSdd?.id ?? 'DOC-SDD-001',
        outcome: 'success',
        correlationId,
        metadata: JSON.stringify({ approvalId, reviewerComment }),
      }).run()

      const txResult = await transition('DDCR_UPDATED', reviewerName)
      return NextResponse.json({ ok: true, newState: txResult.ok ? txResult.newState : 'DDCR_UPDATED', approvalId })
    }
  } catch (err) {
    console.error('[Stage 5 Approve]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
