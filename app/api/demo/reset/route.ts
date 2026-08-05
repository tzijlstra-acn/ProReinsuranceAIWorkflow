import { NextResponse } from 'next/server'
import { db, sqlite } from '@/lib/db/index'
import { demoRuns, auditEvents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { deleteGeneratedArtefacts } from '@/lib/fs-service'

export async function POST() {
  try {
    // ── File-system reset: delete all generated artefacts ──────────────────
    const { skipped } = deleteGeneratedArtefacts()
    // skipped = files locked by another process (e.g. open in Word) — reset continues anyway

    // ── Database reset ─────────────────────────────────────────────────────

    // Reset demo run to BASELINE
    const newCorrelationId = randomUUID()
    db.update(demoRuns)
      .set({ currentState: 'BASELINE', completedAt: null, correlationId: newCorrelationId })
      .where(eq(demoRuns.id, 'DEMO-RUN-001'))
      .run()

    // Clear all generated artifacts (keep seed data)
    sqlite.exec(`
      DELETE FROM evidence_links;
      DELETE FROM evidence_artifacts;
      DELETE FROM approvals;
      DELETE FROM deployments;
      DELETE FROM iac_changes;
      DELETE FROM policy_evaluations WHERE id NOT IN (
        'PE-001-BASELINE','PE-002-BASELINE','PE-003-BASELINE','PE-004-BASELINE','PE-005-BASELINE'
      );
    `)

    // Reset cloud resources to baseline (remove vault and backup items)
    sqlite.exec(`
      DELETE FROM cloud_resources WHERE type IN ('RecoveryVault','BackupProtectedItem','BackupPolicy');
    `)

    // Reset work products
    sqlite.exec(`
      UPDATE compliance_work_products SET status = 'Not Fulfilled', evidence_ids = '[]'
      WHERE name = 'Backup Job Configuration' AND application_id = 'APP-X-001';
    `)

    // Reset guideline versions
    sqlite.exec(`
      UPDATE guideline_versions SET status = 'proposed' WHERE id = 'GLV-BR-001-v33';
      UPDATE guidelines SET current_version_id = 'GLV-BR-001-v32' WHERE id = 'GL-BR-001';
    `)

    // Reset control activity
    sqlite.exec(`
      UPDATE control_activities SET status = 'proposed' WHERE id = 'CA-BR0039-GR';
    `)

    // Reset document versions (remove proposed versions, keep actives)
    sqlite.exec(`
      DELETE FROM document_versions WHERE status IN ('proposed','approved') AND id NOT IN ('DV-SDD-001-v1','DV-OM-001-v1');
    `)

    // Reset portfolio IT App X back to non-compliant
    sqlite.exec(`
      UPDATE portfolio_apps SET backup_compliant = 0, geo_redundant = 0 WHERE app_id = 'APP-X-001';
    `)

    // Add audit event
    db.insert(auditEvents).values({
      id: randomUUID(),
      actor: 'user',
      action: 'DEMO_RESET',
      objectType: 'DemoRun',
      objectId: 'DEMO-RUN-001',
      outcome: 'success',
      correlationId: newCorrelationId,
      metadata: JSON.stringify({ message: 'Demo reset to BASELINE state — generated artefacts deleted' }),
    }).run()

    // ── Reset guided run state ─────────────────────────────────────────────
    try {
      sqlite.exec(`
        UPDATE guided_runs SET
          state = 'idle',
          current_step = 0,
          current_action = '',
          paused_at_approval = 0,
          approval_type = NULL,
          completed_steps = '[]',
          failed_step = NULL,
          failure_message = NULL,
          last_updated_at = datetime('now')
        WHERE id = 'GUIDED-RUN-001';
      `)
    } catch { /* table may not exist yet — safe to ignore */ }

    return NextResponse.json({
      ok: true,
      newState: 'BASELINE',
      correlationId: newCorrelationId,
      ...(skipped.length > 0 && {
        warning: `${skipped.length} file(s) could not be deleted (likely open in another application). Close them and reset again if needed.`,
        skippedFiles: skipped.map(f => f.split(/[\\/]/).slice(-2).join('/')),
      }),
    })
  } catch (err) {
    console.error('[Demo Reset]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
