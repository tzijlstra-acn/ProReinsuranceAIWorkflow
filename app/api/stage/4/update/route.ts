import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { auditEvents, complianceWorkProducts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { updateDdcrWorkProducts } from '@/lib/ddcr-adapter'
import { transition, getCurrentState } from '@/lib/state-machine'
import { randomUUID } from 'crypto'
import {
  Paths,
  readJsonFile,
  appendTransformLog,
  hashString,
  hashFile,
  fileExists,
} from '@/lib/fs-service'
import { parseCsv, writeCsv } from '@/lib/csv-service'

export async function POST() {
  try {
    const { state, correlationId } = await getCurrentState()
    if (state !== 'POLICY_VERIFIED') {
      return NextResponse.json({ error: `Cannot update DDCR in state ${state}` }, { status: 400 })
    }

    const timestamp = new Date().toISOString()

    // ── Read actual policy evaluation from disk ────────────────────────────
    if (!fileExists(Paths.generated.policyEvalAfter)) {
      return NextResponse.json({ error: 'Policy evaluation file not found — run stage 3 first' }, { status: 400 })
    }

    const policyEval = readJsonFile<{
      evaluatedAt: string
      applicationId: string
      evaluations: Array<{ policyCode: string; status: string }>
      backupCompliant: boolean
    }>(Paths.generated.policyEvalAfter)

    // Determine new status from policy evaluation
    const newStatus = policyEval.backupCompliant ? 'Fulfilled' : 'Not Fulfilled'

    // Get current DDCR DB value (before update)
    const wpBefore = db.select().from(complianceWorkProducts)
      .where(eq(complianceWorkProducts.applicationId, 'APP-X-001'))
      .all()
      .find(w => w.name === 'Backup Job Configuration')

    const oldStatus = wpBefore?.status ?? 'Not Fulfilled'

    // Update via existing adapter
    const updates = updateDdcrWorkProducts('APP-X-001', correlationId)

    // ── Generate DDCR after-state CSV ─────────────────────────────────────
    const rawDdcrRecords = parseCsv<Record<string, string>>(Paths.raw.ddcrBefore)

    const updatedDdcrRecords = rawDdcrRecords.map(row => {
      if (row.application_id === 'APP-X-001' && row.work_product === 'Backup Job Configuration') {
        return {
          ...row,
          status: newStatus,
          last_updated: timestamp.split('T')[0],
          evidence_source: `Policy evaluation: ${Paths.generated.policyEvalAfter}`,
          fulfillment_notes: policyEval.backupCompliant
            ? 'GRS vault rsv-app-x-001-prod configured. POL-BACKUP-001 and POL-BACKUP-002 both Compliant.'
            : 'Backup policy evaluation did not pass all checks.',
        }
      }
      return row
    })

    writeCsv(Paths.generated.ddcrAfter, updatedDdcrRecords)

    // Append transform log
    appendTransformLog({
      timestamp,
      transformationId: randomUUID(),
      sourceSystem: 'DDCR (CSV export)',
      sourceFile: Paths.raw.ddcrBefore,
      sourceVersion: 'export-2025-01',
      sourceHash: hashFile(Paths.raw.ddcrBefore),
      targetFile: Paths.generated.ddcrAfter,
      targetVersion: 'export-2025-02',
      targetHash: hashString(JSON.stringify(updatedDdcrRecords)),
      operation: 'DDCR_UPDATE',
      actor: 'ddcr-adapter',
      correlationId,
    })

    db.insert(auditEvents).values({
      id: randomUUID(),
      actor: 'ddcr-adapter',
      action: 'DDCR_UPDATE_COMPLETE',
      objectType: 'Application',
      objectId: 'APP-X-001',
      outcome: 'success',
      correlationId,
      metadata: JSON.stringify({
        updates,
        oldStatus,
        newStatus,
        policyEvalFile: Paths.generated.policyEvalAfter,
        ddcrAfterFile: Paths.generated.ddcrAfter,
        backupCompliant: policyEval.backupCompliant,
      }),
    }).run()

    const txResult = await transition('DDCR_UPDATED', 'system:ddcr-adapter')
    if (!txResult.ok) return NextResponse.json({ error: txResult.error }, { status: 400 })

    return NextResponse.json({
      ok: true,
      newState: txResult.newState,
      updates,
      oldStatus,
      newStatus,
      files: {
        policyEvalAfter: Paths.generated.policyEvalAfter,
        ddcrAfter: Paths.generated.ddcrAfter,
      },
    })
  } catch (err) {
    console.error('[Stage 4 Update]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
