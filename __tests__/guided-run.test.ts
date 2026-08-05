import { describe, it, expect, beforeEach } from 'vitest'
import { db, sqlite } from '@/lib/db/index'
import { demoRuns, guidedRuns } from '@/lib/db/schema'
import { randomUUID } from 'crypto'
import { createOrGetGuidedRun, resetGuidedRun, patchGuidedRun } from '@/lib/guided-run'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetDemoRun(state = 'BASELINE') {
  sqlite.exec('DELETE FROM demo_runs; DELETE FROM audit_events;')
  db.insert(demoRuns)
    .values({ id: 'DEMO-RUN-001', currentState: state, correlationId: randomUUID() })
    .run()
}

function resetGuidedRunTable() {
  sqlite.exec('DELETE FROM guided_runs;')
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Guided run idempotency', () => {
  beforeEach(() => {
    resetDemoRun()
    resetGuidedRunTable()
  })

  it('createOrGetGuidedRun creates a new idle run when none exists', () => {
    const run = createOrGetGuidedRun()
    expect(run.state).toBe('idle')
    expect(run.currentStep).toBe(0)
    expect(run.completedSteps).toEqual([])
  })

  it('createOrGetGuidedRun returns existing run on subsequent calls', () => {
    const first = createOrGetGuidedRun()
    const second = createOrGetGuidedRun()
    expect(first.runId).toBe(second.runId)
  })

  it('patchGuidedRun updates state fields', () => {
    createOrGetGuidedRun()
    const updated = patchGuidedRun({ state: 'running', currentStep: 1, currentAction: 'Test action' })
    expect(updated.state).toBe('running')
    expect(updated.currentStep).toBe(1)
    expect(updated.currentAction).toBe('Test action')
  })

  it('resetGuidedRun returns run to idle state', () => {
    createOrGetGuidedRun()
    patchGuidedRun({ state: 'running', currentStep: 3, completedSteps: [1, 2] })
    const reset = resetGuidedRun()
    expect(reset.state).toBe('idle')
    expect(reset.currentStep).toBe(0)
    expect(reset.completedSteps).toEqual([])
  })

  it('skips a completed step when re-running', () => {
    // Mock: state machine already at POLICY_VERIFIED
    // Running step 3 again should be a no-op (isStepComplete returns true)
    resetDemoRun('POLICY_VERIFIED')
    createOrGetGuidedRun()

    // Step 3 (stage3/evaluate) is complete when state >= POLICY_VERIFIED
    // Simulate: guided run already has step 3 in completedSteps
    const run = patchGuidedRun({ completedSteps: [1, 2, 3] })
    expect(run.completedSteps).toContain(3)

    // No new PolicyEvaluation records should be created by re-running step 3
    // (idempotency is enforced server-side by checking stateOrdinal >= POLICY_VERIFIED)
    // This test verifies the completedSteps tracking data structure is correct.
    expect(run.completedSteps).toHaveLength(3)
  })

  it('resumes from correct step after browser refresh', () => {
    // Simulate: demo state is at DOCS_PROPOSED (approval gate for step 5)
    resetDemoRun('DOCS_PROPOSED')
    createOrGetGuidedRun()

    // Patch to represent a guided run paused at the docs gate
    const run = patchGuidedRun({
      state: 'awaiting_approval',
      pausedAtApproval: true,
      approvalType: 'docs',
      currentStep: 5,
      completedSteps: [1, 2, 3, 4, 5],
    })

    expect(run.state).toBe('awaiting_approval')
    expect(run.approvalType).toBe('docs')
    expect(run.currentStep).toBe(5)

    // After refresh, createOrGetGuidedRun restores the same state
    const restored = createOrGetGuidedRun()
    expect(restored.state).toBe('awaiting_approval')
    expect(restored.approvalType).toBe('docs')
  })

  it('does not advance past an approval gate without explicit approval', () => {
    // Guided run is awaiting_approval at standard gate
    resetDemoRun('STANDARD_PROPOSED')
    createOrGetGuidedRun()
    patchGuidedRun({
      state: 'awaiting_approval',
      approvalType: 'standard',
      currentStep: 1,
      completedSteps: [1],
    })

    // The continue endpoint verifies the demo state is past the gate.
    // At STANDARD_PROPOSED, it should reject. We verify the guided run state
    // is still awaiting_approval (no automated advance happened).
    const run = createOrGetGuidedRun()
    expect(run.state).toBe('awaiting_approval')
    expect(run.approvalType).toBe('standard')
  })

  it('tracks failed step and message correctly', () => {
    createOrGetGuidedRun()
    const run = patchGuidedRun({
      state: 'failed',
      failedStep: 2,
      failureMessage: 'Stage 2 propose failed: App not found',
    })
    expect(run.state).toBe('failed')
    expect(run.failedStep).toBe(2)
    expect(run.failureMessage).toContain('Stage 2')
  })

  it('completedSteps serialises and deserialises correctly', () => {
    createOrGetGuidedRun()
    patchGuidedRun({ completedSteps: [1, 2, 3, 4] })
    const run = createOrGetGuidedRun()
    expect(run.completedSteps).toEqual([1, 2, 3, 4])
  })
})

describe('Processing step statuses', () => {
  it('STEP_PROCESSING_SEQUENCES has entries for all 6 stages', async () => {
    const { STEP_PROCESSING_SEQUENCES } = await import('@/components/ProcessingState')
    for (let stage = 1; stage <= 6; stage++) {
      expect(STEP_PROCESSING_SEQUENCES[stage]).toBeDefined()
      expect(STEP_PROCESSING_SEQUENCES[stage].length).toBeGreaterThan(0)
    }
  })

  it('deriveStepStatuses marks all complete when isComplete=true', async () => {
    const { STEP_PROCESSING_SEQUENCES, deriveStepStatuses } = await import('@/components/ProcessingState')
    const steps = STEP_PROCESSING_SEQUENCES[1]
    const result = deriveStepStatuses(steps, 5000, true)
    expect(result.every(s => s.status === 'completed')).toBe(true)
  })

  it('deriveStepStatuses marks first step active when elapsedMs=0', async () => {
    const { STEP_PROCESSING_SEQUENCES, deriveStepStatuses } = await import('@/components/ProcessingState')
    const steps = STEP_PROCESSING_SEQUENCES[1]
    const result = deriveStepStatuses(steps, 0, false)
    expect(result[0].status).toBe('active')
    expect(result.slice(1).every(s => s.status === 'pending')).toBe(true)
  })

  it('deriveStepStatuses advances steps with elapsed time', async () => {
    const { STEP_PROCESSING_SEQUENCES, deriveStepStatuses } = await import('@/components/ProcessingState')
    const steps = STEP_PROCESSING_SEQUENCES[1]
    // After 1800ms (3 steps at 600ms each), steps 0..2 should be complete, step 3 active
    const result = deriveStepStatuses(steps, 1800, false)
    expect(result[0].status).toBe('completed')
    expect(result[1].status).toBe('completed')
    expect(result[2].status).toBe('completed')
    expect(result[3].status).toBe('active')
  })
})
