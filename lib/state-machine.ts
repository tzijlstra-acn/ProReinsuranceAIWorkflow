import { db } from './db/index'
import { demoRuns, auditEvents } from './db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export type DemoState =
  | 'BASELINE'
  | 'STANDARD_PROPOSED'
  | 'STANDARD_APPROVED'
  | 'IAC_PR_CREATED'
  | 'DEPLOYMENT_APPROVED'
  | 'DEPLOYED'
  | 'POLICY_VERIFIED'
  | 'DDCR_UPDATED'
  | 'DOCS_PROPOSED'
  | 'DOCS_APPROVED'
  | 'EVIDENCE_READY'

type TransitionResult = { ok: true; newState: DemoState } | { ok: false; error: string }

const VALID_TRANSITIONS: Record<DemoState, DemoState[]> = {
  BASELINE: ['STANDARD_PROPOSED'],
  STANDARD_PROPOSED: ['STANDARD_APPROVED', 'BASELINE'],
  STANDARD_APPROVED: ['IAC_PR_CREATED'],
  IAC_PR_CREATED: ['DEPLOYMENT_APPROVED', 'STANDARD_APPROVED'],
  DEPLOYMENT_APPROVED: ['DEPLOYED'],
  DEPLOYED: ['POLICY_VERIFIED'],
  POLICY_VERIFIED: ['DDCR_UPDATED'],
  DDCR_UPDATED: ['DOCS_PROPOSED'],
  DOCS_PROPOSED: ['DOCS_APPROVED', 'DDCR_UPDATED'],
  DOCS_APPROVED: ['EVIDENCE_READY'],
  EVIDENCE_READY: [],
}

const TRANSITION_LABELS: Record<string, string> = {
  'BASELINE->STANDARD_PROPOSED': 'AI generates guideline & control proposal',
  'STANDARD_PROPOSED->STANDARD_APPROVED': 'Human approves standard update',
  'STANDARD_PROPOSED->BASELINE': 'Human rejects — proposal reset',
  'STANDARD_APPROVED->IAC_PR_CREATED': 'AI generates IaC change',
  'IAC_PR_CREATED->DEPLOYMENT_APPROVED': 'Human approves PR & deployment',
  'IAC_PR_CREATED->STANDARD_APPROVED': 'Human rejects PR — back to approved standard',
  'DEPLOYMENT_APPROVED->DEPLOYED': 'Simulated deployment executes',
  'DEPLOYED->POLICY_VERIFIED': 'Policy engine evaluates cloud state',
  'POLICY_VERIFIED->DDCR_UPDATED': 'DDCR adapter updates work products',
  'DDCR_UPDATED->DOCS_PROPOSED': 'AI generates documentation update',
  'DOCS_PROPOSED->DOCS_APPROVED': 'Human approves documentation',
  'DOCS_PROPOSED->DDCR_UPDATED': 'Human rejects docs — back to DDCR updated',
  'DOCS_APPROVED->EVIDENCE_READY': 'RQMT evidence compiled',
}

export async function getCurrentState(): Promise<{ state: DemoState; correlationId: string; runId: string }> {
  const run = db.select().from(demoRuns).where(eq(demoRuns.id, 'DEMO-RUN-001')).get()
  if (!run) throw new Error('No demo run found — run db:seed first')
  return { state: run.currentState as DemoState, correlationId: run.correlationId, runId: run.id }
}

export async function transition(
  targetState: DemoState,
  actor: string = 'system',
  metadata: Record<string, unknown> = {}
): Promise<TransitionResult> {
  const { state: currentState, correlationId, runId } = await getCurrentState()

  // Idempotent: already in target state
  if (currentState === targetState) {
    return { ok: true, newState: targetState }
  }

  const allowed = VALID_TRANSITIONS[currentState] || []
  if (!allowed.includes(targetState)) {
    return {
      ok: false,
      error: `Invalid transition: ${currentState} → ${targetState}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
    }
  }

  const transitionKey = `${currentState}->${targetState}`
  const label = TRANSITION_LABELS[transitionKey] || transitionKey

  // Update demo run state
  db.update(demoRuns)
    .set({ currentState: targetState })
    .where(eq(demoRuns.id, runId))
    .run()

  // Write audit event
  db.insert(auditEvents).values({
    id: randomUUID(),
    actor,
    action: `STATE_TRANSITION:${transitionKey}`,
    objectType: 'DemoRun',
    objectId: runId,
    objectVersion: targetState,
    outcome: 'success',
    correlationId,
    metadata: JSON.stringify({
      fromState: currentState,
      toState: targetState,
      label,
      ...metadata,
    }),
  }).run()

  return { ok: true, newState: targetState }
}

export function getStageForState(state: DemoState): number {
  const stageMap: Record<DemoState, number> = {
    BASELINE: 0,
    STANDARD_PROPOSED: 1,
    STANDARD_APPROVED: 1,
    IAC_PR_CREATED: 2,
    DEPLOYMENT_APPROVED: 2,
    DEPLOYED: 2,
    POLICY_VERIFIED: 3,
    DDCR_UPDATED: 4,
    DOCS_PROPOSED: 5,
    DOCS_APPROVED: 5,
    EVIDENCE_READY: 6,
  }
  return stageMap[state] ?? 0
}

export function getStateLabel(state: DemoState): string {
  const labels: Record<DemoState, string> = {
    BASELINE: 'Baseline — Non-Compliant',
    STANDARD_PROPOSED: 'Guideline & Control Proposed',
    STANDARD_APPROVED: 'Standard Approved',
    IAC_PR_CREATED: 'IaC PR Created',
    DEPLOYMENT_APPROVED: 'Deployment Approved',
    DEPLOYED: 'Deployed (Simulated)',
    POLICY_VERIFIED: 'Policies Verified',
    DDCR_UPDATED: 'DDCR Updated',
    DOCS_PROPOSED: 'Documentation Proposed',
    DOCS_APPROVED: 'Documentation Approved',
    EVIDENCE_READY: 'Evidence Ready',
  }
  return labels[state] || state
}

export function isApprovalGate(state: DemoState): boolean {
  return ['STANDARD_PROPOSED', 'IAC_PR_CREATED', 'DOCS_PROPOSED'].includes(state)
}

export function getAllowedTransitions(state: DemoState): DemoState[] {
  return VALID_TRANSITIONS[state] || []
}
