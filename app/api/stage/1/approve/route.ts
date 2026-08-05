import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { guidelineVersions, guidelines, controlActivities, approvals, auditEvents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { transition, getCurrentState } from '@/lib/state-machine'
import { randomUUID } from 'crypto'
import {
  Paths,
  hashFile,
  hashString,
  appendTransformLog,
  readTextFile,
  fileExists,
} from '@/lib/fs-service'
import { createGuidelineV2Docx, extractDocxText } from '@/lib/docx-service'
import { parseCsv, writeCsv } from '@/lib/csv-service'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { decision: 'approved' | 'rejected'; reviewerComment?: string; reviewerName?: string }
    const { decision, reviewerComment = '', reviewerName = 'Compliance Review Board' } = body

    const { state, correlationId } = await getCurrentState()
    if (state !== 'STANDARD_PROPOSED') {
      return NextResponse.json({ error: `Cannot approve in state ${state}` }, { status: 400 })
    }

    const approvalId = randomUUID()

    // Record approval
    db.insert(approvals).values({
      id: approvalId,
      objectType: 'GuidelineVersion',
      objectId: 'GLV-BR-001-v33',
      objectVersion: '3.3',
      decision,
      reviewerComment,
      reviewerName,
      correlationId,
    }).run()

    if (decision === 'approved') {
      const timestamp = new Date().toISOString()

      // ── File-system work ───────────────────────────────────────────────────

      // 1. Read v2 template text from disk
      if (!fileExists(Paths.raw.guidelineV2Template)) {
        return NextResponse.json({ error: 'Guideline v2 template not found on disk' }, { status: 500 })
      }
      const templateText = readTextFile(Paths.raw.guidelineV2Template)

      // 2. Create v2 DOCX from template
      await createGuidelineV2Docx(Paths.generated.guidelineV2, templateText)

      // 3. Extract text from v1 and v2 for diff evidence
      const v1Text = await extractDocxText(Paths.raw.guidelineV1)
      const v2Text = await extractDocxText(Paths.generated.guidelineV2)

      // 4. Log the guideline transformation
      appendTransformLog({
        timestamp,
        transformationId: randomUUID(),
        sourceSystem: 'Product Hub (raw)',
        sourceFile: Paths.raw.guidelineV1,
        sourceVersion: 'v1.0',
        sourceHash: hashFile(Paths.raw.guidelineV1),
        targetFile: Paths.generated.guidelineV2,
        targetVersion: 'v2.0',
        targetHash: hashFile(Paths.generated.guidelineV2),
        operation: 'GUIDELINE_APPROVE',
        actor: reviewerName,
        approvalId,
        correlationId,
      })

      // 5. Build updated control activities CSV with new BR0039-GR row
      const existingControls = parseCsv<Record<string, string>>(Paths.raw.controlsBefore)
      const newControl: Record<string, string> = {
        control_id: 'BR0039-GR',
        title: 'Backup Geographic Redundancy Verification',
        objective: 'Ensure backup data is stored with geographic redundancy (GRZ) per DORA Article 12(4)',
        scope: 'All High and Critical IT systems in Azure OneCloud',
        frequency: 'Continuous (automated policy evaluation); Quarterly (restore test)',
        owner_role: 'Platform Engineering Lead',
        status: 'Active',
        evidence_requirements: 'Policy evaluation report (POL-BACKUP-001 + POL-BACKUP-002); vault config export; restore test results (quarterly)',
        source_regulation: 'DORA Article 12(4)',
        geographic_replication_required: 'Yes',
      }
      const updatedControls = [...existingControls, newControl]
      writeCsv(Paths.generated.controlsAfter, updatedControls)

      // 6. Log the control catalog transformation
      appendTransformLog({
        timestamp,
        transformationId: randomUUID(),
        sourceSystem: 'Control Catalog (CSV)',
        sourceFile: Paths.raw.controlsBefore,
        sourceVersion: 'export-2025-01',
        sourceHash: hashFile(Paths.raw.controlsBefore),
        targetFile: Paths.generated.controlsAfter,
        targetVersion: 'export-2025-02',
        targetHash: hashString(JSON.stringify(updatedControls)),
        operation: 'CONTROL_CATALOG_UPDATE',
        actor: reviewerName,
        approvalId,
        correlationId,
      })

      // ── Database work ──────────────────────────────────────────────────────

      // Promote guideline v3.3 to active
      db.update(guidelineVersions)
        .set({ status: 'approved', approvalId })
        .where(eq(guidelineVersions.id, 'GLV-BR-001-v33'))
        .run()

      db.update(guidelineVersions)
        .set({ status: 'superseded' })
        .where(eq(guidelineVersions.id, 'GLV-BR-001-v32'))
        .run()

      db.update(guidelines)
        .set({ currentVersionId: 'GLV-BR-001-v33' })
        .where(eq(guidelines.id, 'GL-BR-001'))
        .run()

      // Approve control activity
      db.update(controlActivities)
        .set({ status: 'approved' })
        .where(eq(controlActivities.id, 'CA-BR0039-GR'))
        .run()

      db.insert(auditEvents).values({
        id: randomUUID(),
        actor: reviewerName,
        action: 'STANDARD_APPROVED',
        objectType: 'GuidelineVersion',
        objectId: 'GLV-BR-001-v33',
        objectVersion: '3.3',
        outcome: 'success',
        correlationId,
        metadata: JSON.stringify({
          reviewerComment,
          approvalId,
          guidelineV2File: Paths.generated.guidelineV2,
          guidelineV2Hash: hashFile(Paths.generated.guidelineV2),
          controlsAfterFile: Paths.generated.controlsAfter,
          v1Length: v1Text.length,
          v2Length: v2Text.length,
        }),
      }).run()

      const txResult = await transition('STANDARD_APPROVED', reviewerName, { approvalId, reviewerComment })
      if (!txResult.ok) return NextResponse.json({ error: txResult.error }, { status: 400 })

      return NextResponse.json({
        ok: true,
        newState: txResult.newState,
        approvalId,
        files: {
          guidelineV2: Paths.generated.guidelineV2,
          guidelineV2Hash: hashFile(Paths.generated.guidelineV2),
          controlsAfter: Paths.generated.controlsAfter,
        },
      })
    } else {
      // Rejected — reset proposal
      db.update(guidelineVersions)
        .set({ status: 'proposed' })
        .where(eq(guidelineVersions.id, 'GLV-BR-001-v33'))
        .run()

      db.insert(auditEvents).values({
        id: randomUUID(),
        actor: reviewerName,
        action: 'STANDARD_REJECTED',
        objectType: 'GuidelineVersion',
        objectId: 'GLV-BR-001-v33',
        outcome: 'success',
        correlationId,
        metadata: JSON.stringify({ reviewerComment, approvalId }),
      }).run()

      const txResult = await transition('BASELINE', reviewerName)
      return NextResponse.json({ ok: true, newState: txResult.ok ? txResult.newState : 'BASELINE', approvalId })
    }
  } catch (err) {
    console.error('[Stage 1 Approve]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
