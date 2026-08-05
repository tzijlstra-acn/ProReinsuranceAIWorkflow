import { db } from '@/lib/db/index'
import { guidedRuns } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { getCurrentState, type DemoState } from '@/lib/state-machine'
import { Paths, fileExists } from '@/lib/fs-service'

// ─── Types ───────────────────────────────────────────────────────────────────

export type GuidedRunState =
  | 'idle'
  | 'running'
  | 'awaiting_approval'
  | 'continuing'
  | 'paused'
  | 'completed'
  | 'failed'

export interface GuidedRun {
  runId: string
  state: GuidedRunState
  currentStep: number // 1-6
  currentAction: string
  pausedAtApproval: boolean
  approvalType: 'standard' | 'iac' | 'docs' | null
  startedAt: string
  lastUpdatedAt: string
  completedSteps: number[]
  failedStep: number | null
  failureMessage: string | null
  correlationId: string
}

const GUIDED_RUN_ID = 'GUIDED-RUN-001'

// ─── State ordinal for idempotency checks ────────────────────────────────────

const STATE_ORDINALS: Record<DemoState, number> = {
  BASELINE: 0,
  STANDARD_PROPOSED: 1,
  STANDARD_APPROVED: 2,
  IAC_PR_CREATED: 3,
  DEPLOYMENT_APPROVED: 4,
  DEPLOYED: 5,
  POLICY_VERIFIED: 6,
  DDCR_UPDATED: 7,
  DOCS_PROPOSED: 8,
  DOCS_APPROVED: 9,
  EVIDENCE_READY: 10,
}

function stateOrdinal(s: DemoState): number {
  return STATE_ORDINALS[s] ?? 0
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

function rowToGuidedRun(row: typeof guidedRuns.$inferSelect): GuidedRun {
  return {
    runId: row.id,
    state: row.state as GuidedRunState,
    currentStep: row.currentStep,
    currentAction: row.currentAction,
    pausedAtApproval: Boolean(row.pausedAtApproval),
    approvalType: (row.approvalType ?? null) as GuidedRun['approvalType'],
    startedAt: row.startedAt ?? new Date().toISOString(),
    lastUpdatedAt: row.lastUpdatedAt ?? new Date().toISOString(),
    completedSteps: JSON.parse(row.completedSteps || '[]') as number[],
    failedStep: row.failedStep ?? null,
    failureMessage: row.failureMessage ?? null,
    correlationId: row.correlationId,
  }
}

export function createOrGetGuidedRun(): GuidedRun {
  const existing = db.select().from(guidedRuns).where(eq(guidedRuns.id, GUIDED_RUN_ID)).get()
  if (existing) return rowToGuidedRun(existing)

  const now = new Date().toISOString()
  db.insert(guidedRuns).values({
    id: GUIDED_RUN_ID,
    state: 'idle',
    currentStep: 0,
    currentAction: '',
    pausedAtApproval: false,
    approvalType: null,
    startedAt: now,
    lastUpdatedAt: now,
    completedSteps: '[]',
    failedStep: null,
    failureMessage: null,
    correlationId: randomUUID(),
  }).run()

  return createOrGetGuidedRun()
}

function patchGuidedRun(patch: Partial<Omit<GuidedRun, 'runId'>> & { completedSteps?: number[] }): GuidedRun {
  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { lastUpdatedAt: now }

  if (patch.state !== undefined) updates.state = patch.state
  if (patch.currentStep !== undefined) updates.currentStep = patch.currentStep
  if (patch.currentAction !== undefined) updates.currentAction = patch.currentAction
  if (patch.pausedAtApproval !== undefined) updates.pausedAtApproval = patch.pausedAtApproval
  if (patch.approvalType !== undefined) updates.approvalType = patch.approvalType
  if (patch.completedSteps !== undefined) updates.completedSteps = JSON.stringify(patch.completedSteps)
  if (patch.failedStep !== undefined) updates.failedStep = patch.failedStep
  if (patch.failureMessage !== undefined) updates.failureMessage = patch.failureMessage

  db.update(guidedRuns)
    .set(updates)
    .where(eq(guidedRuns.id, GUIDED_RUN_ID))
    .run()

  return createOrGetGuidedRun()
}

export function resetGuidedRun(): GuidedRun {
  const now = new Date().toISOString()
  db.update(guidedRuns)
    .set({
      state: 'idle',
      currentStep: 0,
      currentAction: '',
      pausedAtApproval: false,
      approvalType: null,
      lastUpdatedAt: now,
      completedSteps: '[]',
      failedStep: null,
      failureMessage: null,
    })
    .where(eq(guidedRuns.id, GUIDED_RUN_ID))
    .run()
  return createOrGetGuidedRun()
}

// ─── Idempotency helpers ─────────────────────────────────────────────────────

/**
 * Returns true if the step is already completed based on the current demo state.
 * Steps map to stage API calls:
 * 1 → stage1/propose  (BASELINE → STANDARD_PROPOSED)
 * 2 → stage2/propose  (STANDARD_APPROVED → IAC_PR_CREATED)
 * 3 → stage3/evaluate (DEPLOYED → POLICY_VERIFIED)
 * 4 → stage4/update   (POLICY_VERIFIED → DDCR_UPDATED)
 * 5 → stage5/propose  (DDCR_UPDATED → DOCS_PROPOSED)
 * 6 → stage6/generate (EVIDENCE_READY — no state change; check file)
 */
function isStepComplete(step: number, demoState: DemoState): boolean {
  const ord = stateOrdinal(demoState)
  switch (step) {
    case 1: return ord >= STATE_ORDINALS['STANDARD_PROPOSED']
    case 2: return ord >= STATE_ORDINALS['IAC_PR_CREATED']
    case 3: return ord >= STATE_ORDINALS['POLICY_VERIFIED']
    case 4: return ord >= STATE_ORDINALS['DDCR_UPDATED']
    case 5: return ord >= STATE_ORDINALS['DOCS_PROPOSED']
    case 6: return ord >= STATE_ORDINALS['EVIDENCE_READY'] && fileExists(Paths.generated.evidenceManifest)
    default: return false
  }
}

function isAtApprovalGate(demoState: DemoState): 'standard' | 'iac' | 'docs' | null {
  switch (demoState) {
    case 'STANDARD_PROPOSED': return 'standard'
    case 'IAC_PR_CREATED': return 'iac'
    case 'DOCS_PROPOSED': return 'docs'
    default: return null
  }
}

// ─── Stage API caller ────────────────────────────────────────────────────────

async function callStageApi(
  baseUrl: string,
  path: string,
  method = 'POST',
): Promise<{ ok: boolean; newState?: string; error?: string; [key: string]: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
  })
  return res.json() as Promise<{ ok: boolean; newState?: string; error?: string }>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))

// ─── Core execution logic ────────────────────────────────────────────────────

interface ExecuteResult {
  paused: boolean
  approvalType: 'standard' | 'iac' | 'docs' | null
  completedInThisRun: number[]
  completed: boolean
}

/**
 * Execute all non-approval steps from the current demo state forward until
 * hitting an approval gate or completing all steps.
 *
 * Every step is idempotent: if already completed, it is skipped.
 */
export async function executeFromCurrentState(baseUrl: string): Promise<ExecuteResult> {
  const completedInThisRun: number[] = []
  const run = createOrGetGuidedRun()
  const completedSteps = [...run.completedSteps]

  const refreshState = async () => (await getCurrentState()).state

  // ── Step 1: Stage 1 propose ──────────────────────────────────────────────
  let demoState = await refreshState()

  if (!isStepComplete(1, demoState)) {
    patchGuidedRun({ currentStep: 1, currentAction: 'Generating guideline and control proposal', state: 'running' })
    const r = await callStageApi(baseUrl, '/api/stage/1/propose')
    if (!r.ok) {
      // Re-read state: a concurrent execution may have already advanced past this step
      demoState = await refreshState()
      if (!isStepComplete(1, demoState)) {
        patchGuidedRun({ state: 'failed', failedStep: 1, failureMessage: String(r.error ?? 'Stage 1 propose failed') })
        throw new Error(String(r.error ?? 'Stage 1 propose failed'))
      }
    } else {
      demoState = await refreshState()
    }
    completedInThisRun.push(1)
    completedSteps.push(1)
    patchGuidedRun({ completedSteps })
    await sleep(1500)
  }

  // ── Approval gate: standard ──────────────────────────────────────────────
  const gate1 = isAtApprovalGate(demoState)
  if (gate1 === 'standard') {
    patchGuidedRun({ state: 'awaiting_approval', pausedAtApproval: true, approvalType: 'standard', currentAction: 'Awaiting standard approval' })
    return { paused: true, approvalType: 'standard', completedInThisRun, completed: false }
  }

  // ── Step 2: Stage 2 propose ──────────────────────────────────────────────
  if (!isStepComplete(2, demoState)) {
    patchGuidedRun({ currentStep: 2, currentAction: 'Generating IaC change proposal', state: 'running' })
    const r = await callStageApi(baseUrl, '/api/stage/2/propose')
    if (!r.ok) {
      demoState = await refreshState()
      if (!isStepComplete(2, demoState)) {
        patchGuidedRun({ state: 'failed', failedStep: 2, failureMessage: String(r.error ?? 'Stage 2 propose failed') })
        throw new Error(String(r.error ?? 'Stage 2 propose failed'))
      }
    } else {
      demoState = await refreshState()
    }
    completedInThisRun.push(2)
    completedSteps.push(2)
    patchGuidedRun({ completedSteps })
    await sleep(1500)
  }

  // ── Approval gate: iac ───────────────────────────────────────────────────
  const gate2 = isAtApprovalGate(demoState)
  if (gate2 === 'iac') {
    patchGuidedRun({ state: 'awaiting_approval', pausedAtApproval: true, approvalType: 'iac', currentAction: 'Awaiting IaC PR approval' })
    return { paused: true, approvalType: 'iac', completedInThisRun, completed: false }
  }

  // ── Step 3: Stage 3 evaluate ─────────────────────────────────────────────
  if (!isStepComplete(3, demoState)) {
    patchGuidedRun({ currentStep: 3, currentAction: 'Evaluating Azure Policy compliance', state: 'running' })
    const r = await callStageApi(baseUrl, '/api/stage/3/evaluate')
    if (!r.ok) {
      demoState = await refreshState()
      if (!isStepComplete(3, demoState)) {
        patchGuidedRun({ state: 'failed', failedStep: 3, failureMessage: String(r.error ?? 'Stage 3 evaluate failed') })
        throw new Error(String(r.error ?? 'Stage 3 evaluate failed'))
      }
    } else {
      demoState = await refreshState()
    }
    completedInThisRun.push(3)
    completedSteps.push(3)
    patchGuidedRun({ completedSteps })
    await sleep(1500)
  }

  // ── Step 4: Stage 4 update ───────────────────────────────────────────────
  if (!isStepComplete(4, demoState)) {
    patchGuidedRun({ currentStep: 4, currentAction: 'Updating DDCR work products', state: 'running' })
    const r = await callStageApi(baseUrl, '/api/stage/4/update')
    if (!r.ok) {
      demoState = await refreshState()
      if (!isStepComplete(4, demoState)) {
        patchGuidedRun({ state: 'failed', failedStep: 4, failureMessage: String(r.error ?? 'Stage 4 update failed') })
        throw new Error(String(r.error ?? 'Stage 4 update failed'))
      }
    } else {
      demoState = await refreshState()
    }
    completedInThisRun.push(4)
    completedSteps.push(4)
    patchGuidedRun({ completedSteps })
    await sleep(1500)
  }

  // ── Step 5: Stage 5 propose ──────────────────────────────────────────────
  if (!isStepComplete(5, demoState)) {
    patchGuidedRun({ currentStep: 5, currentAction: 'Generating documentation updates', state: 'running' })
    const r = await callStageApi(baseUrl, '/api/stage/5/propose')
    if (!r.ok) {
      demoState = await refreshState()
      if (!isStepComplete(5, demoState)) {
        patchGuidedRun({ state: 'failed', failedStep: 5, failureMessage: String(r.error ?? 'Stage 5 propose failed') })
        throw new Error(String(r.error ?? 'Stage 5 propose failed'))
      }
    } else {
      demoState = await refreshState()
    }
    completedInThisRun.push(5)
    completedSteps.push(5)
    patchGuidedRun({ completedSteps })
    await sleep(1500)
  }

  // ── Approval gate: docs ──────────────────────────────────────────────────
  const gate5 = isAtApprovalGate(demoState)
  if (gate5 === 'docs') {
    patchGuidedRun({ state: 'awaiting_approval', pausedAtApproval: true, approvalType: 'docs', currentAction: 'Awaiting documentation approval' })
    return { paused: true, approvalType: 'docs', completedInThisRun, completed: false }
  }

  // ── Step 6: Stage 6 generate ─────────────────────────────────────────────
  if (!isStepComplete(6, demoState)) {
    patchGuidedRun({ currentStep: 6, currentAction: 'Generating evidence package', state: 'running' })
    const r = await callStageApi(baseUrl, '/api/stage/6/generate')
    if (!r.ok) {
      demoState = await refreshState()
      if (!isStepComplete(6, demoState)) {
        patchGuidedRun({ state: 'failed', failedStep: 6, failureMessage: String(r.error ?? 'Stage 6 generate failed') })
        throw new Error(String(r.error ?? 'Stage 6 generate failed'))
      }
    }
    completedInThisRun.push(6)
    completedSteps.push(6)
    patchGuidedRun({ completedSteps })
  }

  // ── All done ─────────────────────────────────────────────────────────────
  patchGuidedRun({
    state: 'completed',
    pausedAtApproval: false,
    approvalType: null,
    currentAction: 'All steps complete',
    currentStep: 6,
  })

  return { paused: false, approvalType: null, completedInThisRun, completed: true }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export { patchGuidedRun }
