'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { StateIndicator } from '@/components/StateIndicator'
import { ApprovalModal } from '@/components/ApprovalModal'
import {
  ProcessingState,
  STEP_PROCESSING_SEQUENCES,
  deriveStepStatuses,
} from '@/components/ProcessingState'
import type { GuidedRun } from '@/lib/guided-run'
import { clsx } from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DemoState {
  state: string
  stageNumber: number
  stateLabel: string
  allowedTransitions: string[]
  workProducts: Array<{ name: string; status: string }>
  policyEvaluations: Array<{ policyCode: string; status: string }>
}

const APPROVAL_ENDPOINTS: Record<string, string> = {
  standard: '/api/stage/1/approve',
  iac: '/api/stage/2/approve',
  docs: '/api/stage/5/approve',
}

const APPROVAL_META: Record<string, { title: string; description: string }> = {
  standard: {
    title: 'Approve Guideline & Control',
    description: 'Review the AI-proposed Backup & Restore Guideline v3.3 and control activity BR0039-GR before proceeding to IaC generation.',
  },
  iac: {
    title: 'Approve IaC Pull Request',
    description: 'Review the Terraform backup.tf diff and approve the simulated deployment to Azure OneCloud.',
  },
  docs: {
    title: 'Approve Documentation Update',
    description: 'Review the AI-generated System Design Document and Operating Manual before publishing.',
  },
}

// ─── Step configuration ───────────────────────────────────────────────────────

interface StepConfig {
  number: number
  label: string
  title: string
  role: string
  sources: string
  targets: string
  approvalRequired: boolean
  evidenceCount: number
  pulledFrom: string[]
  whatHappens: string[]
  writtenTo: string[]
  proposeState?: string
  proposeApi?: string
  proposeLabel?: string
  approveState?: string
  approveApi?: string
  approveTitle?: string
  approveDesc?: string
  actionState?: string
  actionApi?: string
  actionLabel?: string
  isAudit?: boolean
  completedAfterStates: string[]
  completionSummary: { source: string; change: string; evidence: string }
}

const STEPS: StepConfig[] = [
  {
    number: 1,
    label: 'Define',
    title: 'Define Backup Standards & Controls',
    role: 'Control Owner',
    sources: 'EUR-Lex, Product Hub, Control Catalogue',
    targets: 'Guidelines, Control Catalogue, Evidence store',
    approvalRequired: true,
    evidenceCount: 3,
    pulledFrom: ['EUR-Lex (DORA Art. 12)', 'Backup & Restore Guideline v3.2', 'Control Catalogue'],
    whatHappens: ['Requirement identified', 'Guideline gap found', 'Control derived (BR0039-GR)', 'Control Owner reviews & approves'],
    writtenTo: ['Backup & Restore Guideline v3.3', 'Control Catalogue (BR0039-GR)', 'Approval record'],
    proposeState: 'BASELINE',
    proposeApi: '/api/stage/1/propose',
    proposeLabel: 'Propose Changes',
    approveState: 'STANDARD_PROPOSED',
    approveApi: '/api/stage/1/approve',
    approveTitle: 'Approve Guideline v3.3 & Control BR0039-GR',
    approveDesc: 'Review the proposed guideline update and control activity before approving.',
    completedAfterStates: ['STANDARD_APPROVED', 'IAC_PR_CREATED', 'DEPLOYED', 'POLICY_VERIFIED', 'DDCR_UPDATED', 'DOCS_PROPOSED', 'DOCS_APPROVED'],
    completionSummary: {
      source: 'EUR-Lex DORA Art. 12 · Backup & Restore Guideline v3.2',
      change: 'Backup_Restore_Guideline_v3.3.docx · BR0039-GR added to Control Catalogue',
      evidence: '3 transform log entries, DOCX diff, content hash, approval record',
    },
  },
  {
    number: 2,
    label: 'Integrate',
    title: 'Integrate Backup Controls',
    role: 'IT Engineer',
    sources: 'Control Catalogue, IaC Repository',
    targets: 'GitHub / Azure DevOps, Azure OneCloud, Evidence',
    approvalRequired: true,
    evidenceCount: 2,
    pulledFrom: ['Control Catalogue (BR0039-GR, approved)', 'IaC Repository (main.tf)'],
    whatHappens: ['Terraform IaC generated (backup.tf)', 'Pull request created', 'Engineer reviews PR', 'Deployment approved & simulated'],
    writtenTo: ['GitHub / Azure DevOps (backup.tf PR)', 'Azure OneCloud (simulated state)', 'Evidence'],
    proposeState: 'STANDARD_APPROVED',
    proposeApi: '/api/stage/2/propose',
    proposeLabel: 'Generate IaC Change',
    approveState: 'IAC_PR_CREATED',
    approveApi: '/api/stage/2/approve',
    approveTitle: 'Approve IaC PR & Deployment',
    approveDesc: 'Review the Terraform PR and approve the simulated deployment.',
    completedAfterStates: ['DEPLOYED', 'POLICY_VERIFIED', 'DDCR_UPDATED', 'DOCS_PROPOSED', 'DOCS_APPROVED'],
    completionSummary: {
      source: 'Control Catalogue (BR0039-GR) · main.tf',
      change: 'backup.tf (Recovery Services Vault + backup policy) · PR merged · Azure state updated',
      evidence: 'Commit SHA, PR approval record, deployment state diff',
    },
  },
  {
    number: 3,
    label: 'Verify',
    title: 'Verify Backup Control Fulfilment',
    role: 'Policy Engine (automated)',
    sources: 'Azure Policy, Azure APIs',
    targets: 'Policy evaluation store, DDCR alert',
    approvalRequired: false,
    evidenceCount: 2,
    pulledFrom: ['Azure Policy (POL-BACKUP-001/002)', 'Azure APIs (resource state)'],
    whatHappens: ['Policy engine evaluates cloud state', 'POL-BACKUP-001: Compliant', 'POL-BACKUP-002: Compliant (GRZ)'],
    writtenTo: ['Policy evaluation store (policy_evaluation_after.json)', 'DDCR (alert trigger)'],
    actionState: 'DEPLOYED',
    actionApi: '/api/stage/3/evaluate',
    actionLabel: 'Run Policy Evaluation',
    completedAfterStates: ['POLICY_VERIFIED', 'DDCR_UPDATED', 'DOCS_PROPOSED', 'DOCS_APPROVED'],
    completionSummary: {
      source: 'Azure resource state · policy definitions',
      change: 'policy_evaluation_after.json — POL-BACKUP-001: Compliant · POL-BACKUP-002: Compliant',
      evidence: 'Policy evaluation JSON, resource state hash, evaluation timestamp',
    },
  },
  {
    number: 4,
    label: 'Report',
    title: 'Report Backup Control Fulfilment',
    role: 'AoC Integration (automated)',
    sources: 'Azure APIs, Azure Policy evaluation',
    targets: 'DDCR, DDCR history',
    approvalRequired: false,
    evidenceCount: 1,
    pulledFrom: ['Azure APIs (resource state)', 'Azure Policy evaluation result'],
    whatHappens: ['DDCR adapter reads policy evidence', 'Work product status derived (no manual edit)', '"Backup Job Configuration" → Fulfilled'],
    writtenTo: ['DDCR (Backup Job Configuration → Fulfilled)', 'DDCR history'],
    actionState: 'POLICY_VERIFIED',
    actionApi: '/api/stage/4/update',
    actionLabel: 'Update DDCR',
    completedAfterStates: ['DDCR_UPDATED', 'DOCS_PROPOSED', 'DOCS_APPROVED'],
    completionSummary: {
      source: 'Policy evaluation result (POL-BACKUP-001, POL-BACKUP-002)',
      change: 'DDCR work product "Backup Job Configuration" → Fulfilled',
      evidence: 'DDCR CSV row diff, policy traceability link',
    },
  },
  {
    number: 5,
    label: 'Document',
    title: 'Document Backup Control Fulfilment',
    role: 'Control Owner',
    sources: 'Azure OneCloud, IaC, Product Hub',
    targets: 'Product Hub (SDD v2, OM v2), Evidence',
    approvalRequired: true,
    evidenceCount: 3,
    pulledFrom: ['Azure OneCloud (deployed state)', 'IaC (backup.tf)', 'Product Hub (SDD v1, OM v1)'],
    whatHappens: ['SDD updated with backup configuration', 'Operating Manual updated with backup procedure', 'Control Owner reviews & approves'],
    writtenTo: ['Product Hub (System Design Document v2)', 'Product Hub (Operating Manual v2)', 'Evidence'],
    proposeState: 'DDCR_UPDATED',
    proposeApi: '/api/stage/5/propose',
    proposeLabel: 'Generate Documentation Update',
    approveState: 'DOCS_PROPOSED',
    approveApi: '/api/stage/5/approve',
    approveTitle: 'Approve Documentation Updates',
    approveDesc: 'Review System Design Document and Operating Manual updates before approving.',
    completedAfterStates: ['DOCS_APPROVED'],
    completionSummary: {
      source: 'Azure deployed state · backup.tf · SDD v1 · OM v1',
      change: 'System Design Document v2 + Operating Manual v2 generated',
      evidence: 'DOCX diff, version hashes, approval record',
    },
  },
  {
    number: 6,
    label: 'Prove',
    title: 'Prove Backup Control Fulfilment',
    role: 'RQMT / HCL (automated)',
    sources: 'All stages 1–5 artefacts, DORA Art. 12',
    targets: 'Evidence manifest, Audit response DOCX',
    approvalRequired: false,
    evidenceCount: 6,
    pulledFrom: ['All generated artefacts (Stages 1–5)', 'DORA Article 12'],
    whatHappens: ['Evidence graph assembled from all stages', 'RQMT audit question answered', 'Full traceability: regulation → evidence', 'Evidence package exported'],
    writtenTo: ['Evidence manifest (JSON)', 'Audit response (DOCX)'],
    isAudit: true,
    completedAfterStates: [],
    completionSummary: {
      source: 'All stages 1–5 artefacts',
      change: 'Evidence manifest + RQMT Audit Response DOCX',
      evidence: 'Full traceability chain, 6 transform stages, content hashes',
    },
  },
]

const BEFORE_AFTER_ROWS = [
  { before: 'Guideline gap', after: 'Guideline & Control updated' },
  { before: 'Backup not configured', after: 'Backup + GRZ configured' },
  { before: 'Policy non-compliant', after: 'Policy compliant' },
  { before: 'DDCR unfulfilled', after: 'DDCR fulfilled' },
  { before: 'Documentation incomplete', after: 'Documentation updated' },
  { before: 'Evidence fragmented', after: 'Evidence chain complete' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [demoState, setDemoState] = useState<DemoState | null>(null)
  const [guidedRun, setGuidedRun] = useState<GuidedRun | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [selectedStep, setSelectedStep] = useState(1)
  const [activeTab, setActiveTab] = useState<'overview' | 'sources' | 'changes' | 'before-after' | 'evidence'>('overview')
  const [manualApprovalOpen, setManualApprovalOpen] = useState(false)
  const [manualApprovalConfig, setManualApprovalConfig] = useState({ title: '', desc: '', api: '' })
  const [manualLoading, setManualLoading] = useState(false)
  const [ingestDone, setIngestDone] = useState(false)
  const [ingestLoading, setIngestLoading] = useState(false)

  const stepStartRef = useRef<number>(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Data fetchers ──────────────────────────────────────────────────────────

  const fetchDemoState = useCallback(async () => {
    const res = await fetch('/api/demo/state')
    const data: DemoState = await res.json()
    setDemoState(data)
    setSelectedStep(prev => (prev === 1 ? data.stageNumber : prev))
  }, [])

  const fetchGuidedRun = useCallback(async () => {
    const res = await fetch('/api/guided-run/state')
    const data: GuidedRun = await res.json()
    setGuidedRun(data)
    return data
  }, [])

  useEffect(() => {
    fetchDemoState()
    fetchGuidedRun()
  }, [fetchDemoState, fetchGuidedRun])

  // Poll while guided run is executing
  useEffect(() => {
    if (!guidedRun) return
    const isExecuting = guidedRun.state === 'running' || guidedRun.state === 'continuing'
    if (!isExecuting) return
    const poll = setInterval(async () => {
      const updated = await fetchGuidedRun()
      if (updated.state !== 'running' && updated.state !== 'continuing') {
        await fetchDemoState()
        clearInterval(poll)
      }
    }, 800)
    return () => clearInterval(poll)
  }, [guidedRun?.state, fetchGuidedRun, fetchDemoState])

  // Elapsed timer
  useEffect(() => {
    const isExecuting = guidedRun?.state === 'running' || guidedRun?.state === 'continuing'
    if (isExecuting) {
      stepStartRef.current = Date.now()
      setElapsedMs(0)
      elapsedTimerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - stepStartRef.current)
      }, 100)
    } else {
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current)
        elapsedTimerRef.current = null
      }
    }
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
    }
  }, [guidedRun?.state, guidedRun?.currentStep])

  // ── Actions ────────────────────────────────────────────────────────────────

  const startGuidedRun = async () => {
    setMessage(null)
    await fetch('/api/guided-run/start', { method: 'POST' })
    await fetchGuidedRun()
  }

  const stopGuidedRun = async () => {
    await fetch('/api/guided-run/stop', { method: 'POST' })
    await fetchGuidedRun()
  }

  const reset = async () => {
    setMessage(null)
    await fetch('/api/demo/reset', { method: 'POST' })
    await fetch('/api/guided-run/stop', { method: 'POST' })
    await Promise.all([fetchDemoState(), fetchGuidedRun()])
    setMessage('Reset to BASELINE')
  }

  const handleApprovalDone = useCallback(async () => {
    await Promise.all([fetchDemoState(), fetchGuidedRun()])
  }, [fetchDemoState, fetchGuidedRun])

  const runManualAction = async (apiPath: string, label: string) => {
    setManualLoading(true)
    setMessage(null)
    try {
      const res = await fetch(apiPath, { method: 'POST' })
      const data = await res.json()
      setMessage(data.error ? `Error: ${data.error}` : `${label} complete.`)
      await fetchDemoState()
    } catch (err) {
      setMessage(String(err))
    } finally {
      setManualLoading(false)
    }
  }

  const runIngest = async () => {
    setIngestLoading(true)
    try {
      const res = await fetch('/api/stage/1/ingest', { method: 'POST' })
      const d = await res.json()
      if (d.ok) setIngestDone(true)
    } finally {
      setIngestLoading(false)
    }
  }

  const openManualApproval = (title: string, desc: string, api: string) => {
    setManualApprovalConfig({ title, desc, api })
    setManualApprovalOpen(true)
  }

  const handleManualApproval = async (decision: 'approved' | 'rejected', comment: string, reviewer: string) => {
    setManualLoading(true)
    try {
      const res = await fetch(manualApprovalConfig.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reviewerComment: comment, reviewerName: reviewer }),
      })
      const data = await res.json()
      setMessage(data.error ?? `${decision}. State: ${data.newState}`)
      await fetchDemoState()
    } finally {
      setManualLoading(false)
      setManualApprovalOpen(false)
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const isExecuting = guidedRun?.state === 'running' || guidedRun?.state === 'continuing'
  const isAtGate = guidedRun?.state === 'awaiting_approval' && guidedRun?.approvalType != null
  const activeGuidedStep = guidedRun?.currentStep ?? 0

  const processingStepDefs = activeGuidedStep > 0 ? (STEP_PROCESSING_SEQUENCES[activeGuidedStep] ?? []) : []
  const processingSteps = deriveStepStatuses(
    processingStepDefs,
    elapsedMs,
    !isExecuting && guidedRun?.completedSteps.includes(activeGuidedStep) === true,
  )

  const stageTitle = activeGuidedStep > 0
    ? STEPS.find(s => s.number === activeGuidedStep)?.title ?? `Stage ${activeGuidedStep}`
    : ''

  const approvalType = guidedRun?.approvalType
  const approvalMeta = approvalType ? APPROVAL_META[approvalType] : null
  const approveApiPath = approvalType ? APPROVAL_ENDPOINTS[approvalType] : undefined

  const step = STEPS[selectedStep - 1]
  const isAllDone = demoState?.state === 'DOCS_APPROVED'
  const isStepCompleted =
    demoState !== null &&
    (step.completedAfterStates.includes(demoState.state) || demoState.stageNumber > step.number)
  const canPropose = step.proposeState !== undefined && demoState?.state === step.proposeState
  const canApprove = step.approveState !== undefined && demoState?.state === step.approveState
  const canAction = step.actionState !== undefined && demoState?.state === step.actionState

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!demoState) {
    return (
      <div className="flex items-center justify-center py-16">
        <p style={{ color: 'var(--color-text-muted)' }}>Loading journey…</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* ── Six-step process navigator ─────────────────────────────────── */}
      <div
        className="bg-white p-5"
        style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-base font-bold" style={{ color: 'var(--mr-midnight-blue)' }}>
              Compliance Journey — DORA Article 12
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              IT App X · {demoState.stateLabel}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {message && (
              <span
                className="text-xs px-3 py-1 rounded"
                style={{
                  background: message.startsWith('Error') || message.startsWith('Reset') ? 'rgba(192,57,43,0.08)' : 'rgba(26,124,89,0.08)',
                  color: message.startsWith('Error') ? 'var(--color-danger)' : 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {message}
              </span>
            )}
            <button
              onClick={reset}
              disabled={isExecuting}
              className="px-3 py-1.5 text-xs rounded disabled:opacity-40 transition-colors"
              style={{
                background: 'var(--mr-light-grey)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
            {isExecuting ? (
              <button
                onClick={stopGuidedRun}
                className="px-3 py-1.5 text-xs rounded font-medium transition-colors"
                style={{ background: 'rgba(192,57,43,0.1)', color: 'var(--color-danger)', border: '1px solid rgba(192,57,43,0.3)', cursor: 'pointer' }}
              >
                Stop
              </button>
            ) : (
              <button
                onClick={startGuidedRun}
                disabled={guidedRun?.state === 'completed'}
                className="px-3 py-1.5 text-xs rounded font-semibold text-white disabled:opacity-40 transition-colors"
                style={{ background: 'var(--mr-vibrant-blue)', border: 'none', cursor: 'pointer' }}
              >
                {guidedRun?.state === 'completed'
                  ? 'Complete'
                  : guidedRun?.state === 'awaiting_approval'
                  ? 'Awaiting Approval'
                  : guidedRun?.state === 'paused'
                  ? 'Resume'
                  : 'Run Guided Demo'}
              </button>
            )}
          </div>
        </div>

        <StateIndicator
          currentStage={demoState.stageNumber}
          demoState={demoState.state}
          selectedStage={selectedStep}
          onStageClick={setSelectedStep}
        />

        {/* Processing state when guided run is active */}
        {(isExecuting || (activeGuidedStep > 0 && processingStepDefs.length > 0)) && !isAtGate && (
          <div className="mt-5">
            <ProcessingState
              title={`Step ${activeGuidedStep}: ${stageTitle}`}
              steps={processingSteps}
              elapsedMs={elapsedMs}
              onCancel={isExecuting ? stopGuidedRun : undefined}
            />
          </div>
        )}

        {/* Guided approval gate notice */}
        {isAtGate && approvalMeta && (
          <div
            className="mt-4 p-3 rounded text-sm flex items-center gap-2"
            style={{ background: 'rgba(51,80,184,0.08)', border: '1px solid rgba(51,80,184,0.2)', color: 'var(--mr-midnight-blue)' }}
          >
            <span style={{ color: 'var(--mr-vibrant-blue)' }}>⏱</span>
            <span>
              <span className="font-medium">Approval required: </span>
              {approvalMeta.title} — see modal below
            </span>
          </div>
        )}

        {guidedRun?.state === 'failed' && (
          <div
            className="mt-4 p-3 rounded text-sm"
            style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)', color: 'var(--color-danger)' }}
          >
            Step {guidedRun.failedStep} failed: {guidedRun.failureMessage}
          </div>
        )}
      </div>

      {/* ── End-of-journey before/after ───────────────────────────────── */}
      {isAllDone && selectedStep === 6 && <EndOfJourneyCard />}

      {/* ── Step detail card ─────────────────────────────────────────── */}
      <div
        className="bg-white"
        style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}
      >
        {/* Step header */}
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-start justify-between">
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wider mb-0.5"
                style={{ color: 'var(--mr-vibrant-blue)' }}
              >
                Step {step.number}
              </p>
              <h2 className="text-lg font-bold" style={{ color: 'var(--mr-midnight-blue)' }}>
                {step.title}
              </h2>
            </div>
            <Link
              href={`/stages/${step.number}`}
              className="text-xs mt-1"
              style={{ color: 'var(--mr-vibrant-blue)', textDecoration: 'none' }}
            >
              View detail →
            </Link>
          </div>

          {/* Status summary */}
          <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <div>
              <span className="font-semibold" style={{ color: 'var(--mr-midnight-blue)' }}>Status: </span>
              <StepStatusBadge step={step} demoState={demoState} isCompleted={isStepCompleted} />
              <span className="ml-5 font-semibold" style={{ color: 'var(--mr-midnight-blue)' }}>Role: </span>
              {step.role}
            </div>
            <div>
              <span className="font-semibold" style={{ color: 'var(--mr-midnight-blue)' }}>Approval: </span>
              {step.approvalRequired ? 'Required' : 'Automated'}
              <span className="ml-5 font-semibold" style={{ color: 'var(--mr-midnight-blue)' }}>Evidence: </span>
              {step.evidenceCount} record{step.evidenceCount !== 1 ? 's' : ''}
            </div>
            <div>
              <span className="font-semibold" style={{ color: 'var(--mr-midnight-blue)' }}>Sources: </span>
              {step.sources}
            </div>
            <div>
              <span className="font-semibold" style={{ color: 'var(--mr-midnight-blue)' }}>Targets: </span>
              {step.targets}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div
          className="flex items-center px-6"
          style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--mr-light-grey)' }}
        >
          {(
            [
              { id: 'overview', label: 'Overview' },
              { id: 'sources', label: 'Source Data' },
              { id: 'changes', label: 'Proposed Change' },
              { id: 'before-after', label: 'Before / After' },
              { id: 'evidence', label: 'Evidence' },
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'px-4 py-2.5 text-xs font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'text-[#0f1e32] border-[#3350b8]'
                  : 'text-[#4a5568] border-transparent hover:text-[#0f1e32]',
              )}
              style={{ background: 'transparent', cursor: 'pointer' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === 'overview' && <DataFlowGrid step={step} />}

          {activeTab === 'sources' && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
                Source systems and artefacts read in this step
              </p>
              <ul className="space-y-2">
                {step.pulledFrom.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <span style={{ color: 'var(--mr-vibrant-blue)', fontWeight: 700 }}>→</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === 'changes' && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
                Artefacts created or modified in this step
              </p>
              <ul className="space-y-2 mb-4">
                {step.writtenTo.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>+</span>
                    {s}
                  </li>
                ))}
              </ul>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Full file diff and change details are in{' '}
                <Link href={`/stages/${step.number}`} style={{ color: 'var(--mr-vibrant-blue)' }}>
                  Stage {step.number} detail →
                </Link>
              </p>
            </div>
          )}

          {activeTab === 'before-after' && (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>Before this step</p>
                <div className="space-y-1.5">
                  {step.pulledFrom.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>·</span> {s}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>After this step</p>
                <div className="space-y-1.5">
                  {step.writtenTo.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      <span style={{ color: 'var(--color-success)' }}>✓</span>
                      <span style={{ color: 'var(--color-text-secondary)' }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'evidence' && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
                Evidence generated
              </p>
              <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                {step.evidenceCount} record{step.evidenceCount !== 1 ? 's' : ''} · {step.completionSummary.evidence}
              </p>
              <Link href="/evidence-centre" className="text-xs" style={{ color: 'var(--mr-vibrant-blue)' }}>
                Open Evidence Centre →
              </Link>
            </div>
          )}
        </div>

        {/* Action area */}
        <div
          className="px-6 py-4 flex flex-wrap items-center gap-3"
          style={{
            borderTop: '1px solid var(--color-border)',
            background: 'var(--mr-light-grey)',
            borderRadius: '0 0 var(--radius-md) var(--radius-md)',
          }}
        >
          {/* Step 1: Read Sources */}
          {step.number === 1 && canPropose && (
            <button
              onClick={runIngest}
              disabled={ingestLoading || ingestDone}
              className="px-4 py-2 text-sm font-medium rounded disabled:opacity-50 transition-colors"
              style={{
                background: ingestDone ? 'rgba(26,124,89,0.08)' : 'var(--mr-white)',
                color: ingestDone ? 'var(--color-success)' : 'var(--color-text-secondary)',
                border: `1px solid ${ingestDone ? 'rgba(26,124,89,0.3)' : 'var(--color-border)'}`,
                cursor: ingestLoading || ingestDone ? 'default' : 'pointer',
              }}
            >
              {ingestLoading ? 'Reading…' : ingestDone ? '✓ Sources Read' : 'Read Sources'}
            </button>
          )}

          {step.proposeApi && canPropose && (
            <button
              onClick={() => runManualAction(step.proposeApi!, step.proposeLabel ?? 'Propose')}
              disabled={manualLoading || (step.number === 1 && !ingestDone)}
              className="px-4 py-2 text-sm font-medium rounded text-white disabled:opacity-50 transition-colors"
              style={{ background: 'var(--mr-vibrant-blue)', border: 'none', cursor: 'pointer' }}
            >
              {manualLoading ? 'Generating…' : step.proposeLabel ?? 'Propose Changes'}
            </button>
          )}

          {step.approveApi && canApprove && (
            <button
              onClick={() => openManualApproval(step.approveTitle!, step.approveDesc!, step.approveApi!)}
              className="px-4 py-2 text-sm font-medium rounded text-white transition-colors"
              style={{ background: 'var(--color-success)', border: 'none', cursor: 'pointer' }}
            >
              Review &amp; Approve
            </button>
          )}

          {step.actionApi && canAction && (
            <button
              onClick={() => runManualAction(step.actionApi!, step.actionLabel ?? 'Action')}
              disabled={manualLoading}
              className="px-4 py-2 text-sm font-medium rounded text-white disabled:opacity-50 transition-colors"
              style={{ background: 'var(--mr-vibrant-blue)', border: 'none', cursor: 'pointer' }}
            >
              {manualLoading ? 'Running…' : step.actionLabel ?? 'Execute'}
            </button>
          )}

          {step.isAudit && (
            <Link
              href="/audit"
              className="px-4 py-2 text-sm font-medium rounded text-white"
              style={{ background: 'var(--mr-vibrant-blue)', textDecoration: 'none' }}
            >
              Open Audit Evidence →
            </Link>
          )}

          {isStepCompleted && !canPropose && !canApprove && !canAction && !step.isAudit && (
            <CompletionCard step={step} />
          )}

          {isStepCompleted && selectedStep < 6 && (
            <button
              onClick={() => setSelectedStep(s => s + 1)}
              className="ml-auto px-4 py-2 text-sm font-medium rounded transition-colors"
              style={{
                background: 'var(--mr-light-blue)',
                color: 'var(--mr-midnight-blue)',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
              }}
            >
              Continue Journey →
            </button>
          )}

          {isAllDone && selectedStep === 6 && (
            <div className="flex flex-wrap gap-2">
              <Link href="/audit" className="px-3 py-1.5 text-xs font-medium rounded text-white" style={{ background: 'var(--mr-vibrant-blue)', textDecoration: 'none' }}>
                Open evidence package
              </Link>
              <Link href="/evidence-centre" className="px-3 py-1.5 text-xs font-medium rounded" style={{ background: 'var(--mr-light-grey)', color: 'var(--mr-midnight-blue)', border: '1px solid var(--color-border)', textDecoration: 'none' }}>
                Open evidence folder
              </Link>
              <Link href="/traceability" className="px-3 py-1.5 text-xs font-medium rounded" style={{ background: 'var(--mr-light-grey)', color: 'var(--mr-midnight-blue)', border: '1px solid var(--color-border)', textDecoration: 'none' }}>
                View evidence chain
              </Link>
              <Link href="/portfolio" className="px-3 py-1.5 text-xs font-medium rounded" style={{ background: 'var(--mr-light-grey)', color: 'var(--mr-midnight-blue)', border: '1px solid var(--color-border)', textDecoration: 'none' }}>
                View portfolio
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Manual approval modal (for step-level approve buttons) */}
      <ApprovalModal
        isOpen={manualApprovalOpen}
        title={manualApprovalConfig.title}
        description={manualApprovalConfig.desc}
        onApprove={(comment, reviewer) => handleManualApproval('approved', comment, reviewer)}
        onReject={(comment, reviewer) => handleManualApproval('rejected', comment, reviewer)}
        onClose={() => setManualApprovalOpen(false)}
      />

      {/* Guided mode approval modal */}
      {isAtGate && approvalMeta && approveApiPath && (
        <ApprovalModal
          isOpen
          guidedMode
          approveApiPath={approveApiPath}
          title={approvalMeta.title}
          description={approvalMeta.description}
          onApprove={handleApprovalDone}
          onReject={async () => {
            await fetchDemoState()
            await fetchGuidedRun()
          }}
          onClose={async () => {
            await fetch('/api/guided-run/stop', { method: 'POST' })
            await fetchGuidedRun()
          }}
        />
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepStatusBadge({
  step,
  demoState,
  isCompleted,
}: {
  step: StepConfig
  demoState: DemoState
  isCompleted: boolean
}) {
  const isAwaiting = step.approveState !== undefined && demoState.state === step.approveState
  if (isAwaiting)
    return <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>Awaiting approval</span>
  if (isCompleted)
    return <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Completed</span>
  if (demoState.stageNumber === step.number)
    return <span style={{ color: 'var(--mr-vibrant-blue)', fontWeight: 600 }}>In progress</span>
  return <span style={{ color: 'var(--color-text-muted)' }}>Not started</span>
}

function DataFlowGrid({ step }: { step: StepConfig }) {
  const colStyle: React.CSSProperties = {
    background: 'var(--mr-light-grey)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '0.875rem 1rem',
  }
  const headerStyle: React.CSSProperties = {
    fontSize: '0.625rem',
    fontWeight: 700,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: 'var(--color-text-muted)',
    marginBottom: '0.5rem',
  }
  const itemStyle: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.7,
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
      <div style={colStyle}>
        <div style={headerStyle}>Pulled From</div>
        {step.pulledFrom.map((s, i) => <div key={i} style={itemStyle}>· {s}</div>)}
      </div>
      <div style={colStyle}>
        <div style={headerStyle}>What Happens</div>
        {step.whatHappens.map((s, i) => <div key={i} style={itemStyle}>· {s}</div>)}
      </div>
      <div style={colStyle}>
        <div style={headerStyle}>Written To</div>
        {step.writtenTo.map((s, i) => <div key={i} style={itemStyle}>· {s}</div>)}
      </div>
    </div>
  )
}

function CompletionCard({ step }: { step: StepConfig }) {
  return (
    <div
      className="flex-1 rounded px-4 py-3 text-xs space-y-1"
      style={{ background: 'rgba(26,124,89,0.06)', border: '1px solid rgba(26,124,89,0.2)' }}
    >
      <p className="font-semibold" style={{ color: 'var(--color-success)' }}>
        ✓ Step {step.number} completed
      </p>
      <p style={{ color: 'var(--color-text-secondary)' }}>
        <span className="font-medium" style={{ color: 'var(--mr-midnight-blue)' }}>Source: </span>
        {step.completionSummary.source}
      </p>
      <p style={{ color: 'var(--color-text-secondary)' }}>
        <span className="font-medium" style={{ color: 'var(--mr-midnight-blue)' }}>Change: </span>
        {step.completionSummary.change}
      </p>
      <p style={{ color: 'var(--color-text-secondary)' }}>
        <span className="font-medium" style={{ color: 'var(--mr-midnight-blue)' }}>Evidence: </span>
        {step.completionSummary.evidence}
      </p>
    </div>
  )
}

function EndOfJourneyCard() {
  return (
    <div
      className="bg-white p-6"
      style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--mr-vibrant-blue)' }}>
        Journey Complete
      </p>
      <div className="grid grid-cols-2 gap-8 mb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.375rem' }}>
            Before
          </p>
          <div className="space-y-2">
            {BEFORE_AFTER_ROWS.map((row, i) => (
              <div key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>✗</span>
                {row.before}
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.375rem' }}>
            After
          </p>
          <div className="space-y-2">
            {BEFORE_AFTER_ROWS.map((row, i) => (
              <div key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>✓</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>{row.after}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-sm text-center py-3 italic"
        style={{ color: 'var(--mr-midnight-blue)', borderTop: '1px solid var(--color-border)' }}>
        One requirement. One approved control. One implementation. One traceable evidence chain.
      </p>
    </div>
  )
}
