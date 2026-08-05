import { describe, it, expect, beforeEach } from 'vitest'
import { db, sqlite } from '@/lib/db/index'
import { demoRuns, auditEvents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { transition, getCurrentState, getAllowedTransitions, isApprovalGate, getStageForState } from '@/lib/state-machine'
import { randomUUID } from 'crypto'

function resetDemoRun(state = 'BASELINE') {
  sqlite.exec(`DELETE FROM demo_runs; DELETE FROM audit_events;`)
  db.insert(demoRuns).values({ id: 'DEMO-RUN-001', currentState: state, correlationId: randomUUID() }).run()
}

describe('State Machine', () => {
  describe('getCurrentState', () => {
    beforeEach(() => resetDemoRun())

    it('returns BASELINE after reset', async () => {
      const { state } = await getCurrentState()
      expect(state).toBe('BASELINE')
    })

    it('throws if no demo run exists', async () => {
      sqlite.exec('DELETE FROM demo_runs;')
      await expect(getCurrentState()).rejects.toThrow()
    })
  })

  describe('Valid transitions', () => {
    beforeEach(() => resetDemoRun())

    it('BASELINE → STANDARD_PROPOSED', async () => {
      const result = await transition('STANDARD_PROPOSED', 'test')
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.newState).toBe('STANDARD_PROPOSED')
    })

    it('STANDARD_PROPOSED → STANDARD_APPROVED', async () => {
      resetDemoRun('STANDARD_PROPOSED')
      const result = await transition('STANDARD_APPROVED', 'test')
      expect(result.ok).toBe(true)
    })

    it('STANDARD_PROPOSED → BASELINE (reject)', async () => {
      resetDemoRun('STANDARD_PROPOSED')
      const result = await transition('BASELINE', 'test')
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.newState).toBe('BASELINE')
    })

    it('STANDARD_APPROVED → IAC_PR_CREATED', async () => {
      resetDemoRun('STANDARD_APPROVED')
      const result = await transition('IAC_PR_CREATED', 'test')
      expect(result.ok).toBe(true)
    })

    it('IAC_PR_CREATED → DEPLOYMENT_APPROVED', async () => {
      resetDemoRun('IAC_PR_CREATED')
      const result = await transition('DEPLOYMENT_APPROVED', 'test')
      expect(result.ok).toBe(true)
    })

    it('IAC_PR_CREATED → STANDARD_APPROVED (reject PR)', async () => {
      resetDemoRun('IAC_PR_CREATED')
      const result = await transition('STANDARD_APPROVED', 'test')
      expect(result.ok).toBe(true)
    })

    it('DEPLOYMENT_APPROVED → DEPLOYED', async () => {
      resetDemoRun('DEPLOYMENT_APPROVED')
      const result = await transition('DEPLOYED', 'test')
      expect(result.ok).toBe(true)
    })

    it('DEPLOYED → POLICY_VERIFIED', async () => {
      resetDemoRun('DEPLOYED')
      const result = await transition('POLICY_VERIFIED', 'test')
      expect(result.ok).toBe(true)
    })

    it('POLICY_VERIFIED → DDCR_UPDATED', async () => {
      resetDemoRun('POLICY_VERIFIED')
      const result = await transition('DDCR_UPDATED', 'test')
      expect(result.ok).toBe(true)
    })

    it('DDCR_UPDATED → DOCS_PROPOSED', async () => {
      resetDemoRun('DDCR_UPDATED')
      const result = await transition('DOCS_PROPOSED', 'test')
      expect(result.ok).toBe(true)
    })

    it('DOCS_PROPOSED → DOCS_APPROVED', async () => {
      resetDemoRun('DOCS_PROPOSED')
      const result = await transition('DOCS_APPROVED', 'test')
      expect(result.ok).toBe(true)
    })

    it('DOCS_PROPOSED → DDCR_UPDATED (reject docs)', async () => {
      resetDemoRun('DOCS_PROPOSED')
      const result = await transition('DDCR_UPDATED', 'test')
      expect(result.ok).toBe(true)
    })

    it('DOCS_APPROVED → EVIDENCE_READY', async () => {
      resetDemoRun('DOCS_APPROVED')
      const result = await transition('EVIDENCE_READY', 'test')
      expect(result.ok).toBe(true)
    })
  })

  describe('Invalid transitions', () => {
    beforeEach(() => resetDemoRun())

    it('BASELINE → DEPLOYED (skip states)', async () => {
      const result = await transition('DEPLOYED', 'test')
      expect(result.ok).toBe(false)
    })

    it('BASELINE → EVIDENCE_READY (terminal skip)', async () => {
      const result = await transition('EVIDENCE_READY', 'test')
      expect(result.ok).toBe(false)
    })

    it('EVIDENCE_READY → BASELINE (terminal state)', async () => {
      resetDemoRun('EVIDENCE_READY')
      const result = await transition('BASELINE', 'test')
      expect(result.ok).toBe(false)
    })

    it('STANDARD_APPROVED → POLICY_VERIFIED (skip)', async () => {
      resetDemoRun('STANDARD_APPROVED')
      const result = await transition('POLICY_VERIFIED', 'test')
      expect(result.ok).toBe(false)
    })
  })

  describe('Idempotency', () => {
    it('calling same transition twice is a no-op', async () => {
      resetDemoRun()
      await transition('STANDARD_PROPOSED', 'test')
      const result = await transition('STANDARD_PROPOSED', 'test')
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.newState).toBe('STANDARD_PROPOSED')
    })
  })

  describe('Audit events', () => {
    it('writes audit event on transition', async () => {
      resetDemoRun()
      const before = db.select().from(auditEvents).all().length
      await transition('STANDARD_PROPOSED', 'test-actor')
      const after = db.select().from(auditEvents).all().length
      expect(after).toBeGreaterThan(before)
    })
  })

  describe('Helpers', () => {
    it('getAllowedTransitions for BASELINE', () => {
      const allowed = getAllowedTransitions('BASELINE')
      expect(allowed).toContain('STANDARD_PROPOSED')
    })

    it('getAllowedTransitions for EVIDENCE_READY is empty', () => {
      const allowed = getAllowedTransitions('EVIDENCE_READY')
      expect(allowed).toHaveLength(0)
    })

    it('isApprovalGate returns true for STANDARD_PROPOSED', () => {
      expect(isApprovalGate('STANDARD_PROPOSED')).toBe(true)
    })

    it('isApprovalGate returns false for DEPLOYED', () => {
      expect(isApprovalGate('DEPLOYED')).toBe(false)
    })

    it('getStageForState returns correct stages', () => {
      expect(getStageForState('BASELINE')).toBe(0)
      expect(getStageForState('STANDARD_PROPOSED')).toBe(1)
      expect(getStageForState('DEPLOYED')).toBe(2)
      expect(getStageForState('POLICY_VERIFIED')).toBe(3)
      expect(getStageForState('DDCR_UPDATED')).toBe(4)
      expect(getStageForState('DOCS_PROPOSED')).toBe(5)
      expect(getStageForState('EVIDENCE_READY')).toBe(6)
    })
  })
})
