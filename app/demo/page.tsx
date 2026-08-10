'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { StateIndicator } from '@/components/StateIndicator'
import { ProvenanceStrip } from '@/components/ProvenanceStrip'
import { ApprovalModal } from '@/components/ApprovalModal'

// ─── Stage configuration ──────────────────────────────────────────────────────

interface CompletionSummary {
  source: string
  change: string
  evidence: string
}

interface StageConfig {
  number: number
  title: string
  presenterNote: string
  apiPropose?: string
  apiApprove?: string
  apiAction?: string
  canProposeStates?: string[]
  canApproveStates?: string[]
  canActionStates?: string[]
  isAudit?: boolean
  completionSummary: CompletionSummary
}

const STAGES: StageConfig[] = [
  {
    number: 1,
    title: 'Define Backup Standards & Controls',
    presenterNote: 'We begin with the regulatory obligation. DORA Article 12 requires backup data to be geographically separate from primary systems. The AI reads this regulation and the current guideline, then proposes the minimum change needed: Section 4.3 on Geographic Redundancy. It also proposes a new control activity, BR0039-GR, which maps the regulation to a specific, automated test. A human reviewer approves both before anything moves forward.',
    apiPropose: '/api/stage/1/propose',
    apiApprove: '/api/stage/1/approve',
    canProposeStates: ['BASELINE'],
    canApproveStates: ['STANDARD_PROPOSED'],
    completionSummary: {
      source: 'EUR-Lex DORA Art. 12 · Backup & Restore Guideline v3.2',
      change: 'Backup_Restore_Guideline_v3.3.docx · BR0039-GR added to Control Catalogue',
      evidence: '3 transform log entries, DOCX diff, content hash, approval record',
    },
  },
  {
    number: 2,
    title: 'Integrate Backup Controls',
    presenterNote: 'With the control approved, the AI generates the Infrastructure-as-Code to implement it. You\'re looking at real Terraform HCL that creates a geo-redundant Recovery Services Vault in Azure. This is presented as a pull request — the engineer sees the exact change, reviews it, and approves the simulated deployment. The cloud state is updated locally to reflect what would happen in production.',
    apiPropose: '/api/stage/2/propose',
    apiApprove: '/api/stage/2/approve',
    canProposeStates: ['STANDARD_APPROVED'],
    canApproveStates: ['IAC_PR_CREATED'],
    completionSummary: {
      source: 'Control Catalogue (BR0039-GR) · main.tf',
      change: 'backup.tf (Recovery Services Vault + backup policy) · PR merged · Azure state updated',
      evidence: 'Commit SHA, PR approval record, deployment state diff',
    },
  },
  {
    number: 3,
    title: 'Verify Backup Control Fulfilment',
    presenterNote: 'Immediately after deployment, the policy engine evaluates the cloud state against our policy definitions. POL-BACKUP-001 checks that a vault exists and the VM is protected. POL-BACKUP-002 checks that the vault is geo-redundant. Both return Compliant. This is continuous — every infrastructure change triggers re-evaluation automatically.',
    apiAction: '/api/stage/3/evaluate',
    canActionStates: ['DEPLOYED'],
    completionSummary: {
      source: 'Azure resource state · policy definitions',
      change: 'policy_evaluation_after.json — POL-BACKUP-001: Compliant · POL-BACKUP-002: Compliant',
      evidence: 'Policy evaluation JSON, resource state hash, evaluation timestamp',
    },
  },
  {
    number: 4,
    title: 'Report Backup Control Fulfilment',
    presenterNote: 'The DDCR work product status is not manually updated. It is derived directly from the policy evidence. Because both backup policies are now Compliant, the system automatically sets "Backup Job Configuration" to Fulfilled. This eliminates the manual step of updating compliance registers and removes the risk of human error.',
    apiAction: '/api/stage/4/update',
    canActionStates: ['POLICY_VERIFIED'],
    completionSummary: {
      source: 'Policy evaluation result (POL-BACKUP-001, POL-BACKUP-002)',
      change: 'DDCR work product "Backup Job Configuration" → Fulfilled',
      evidence: 'DDCR CSV row diff, policy traceability link',
    },
  },
  {
    number: 5,
    title: 'Document Backup Control Fulfilment',
    presenterNote: 'The AI generates updates to both the System Design Document and the Operating Manual, using the actual deployed configuration as its source. The proposed sections reference the specific vault name, commit SHA, and policy evaluation results. A human approves the documentation before it is committed. The SDD and Operating Manual are now in the evidence chain.',
    apiPropose: '/api/stage/5/propose',
    apiApprove: '/api/stage/5/approve',
    canProposeStates: ['DDCR_UPDATED'],
    canApproveStates: ['DOCS_PROPOSED'],
    completionSummary: {
      source: 'Azure deployed state · backup.tf · SDD v1 · OM v1',
      change: 'System Design Document v2 + Operating Manual v2 generated',
      evidence: 'DOCX diff, version hashes, approval record',
    },
  },
  {
    number: 6,
    title: 'Prove Backup Control Fulfilment',
    presenterNote: 'This is the moment that matters in an audit. The question is: "How does IT App X fulfil DORA Article 12 backup requirements?" The AI assembles the answer from the complete evidence graph — regulation to standard to control to code to deployment to policy to DDCR to documentation. Every assertion is backed by an evidence item with an internal link. The auditor receives a structured, traceable, defensible answer.',
    isAudit: true,
    completionSummary: {
      source: 'All stages 1–5 artefacts',
      change: 'Evidence manifest + RQMT Audit Response DOCX',
      evidence: 'Full traceability chain, 6 transform stages, content hashes',
    },
  },
]

// Provenance data per stage (compact for board demo view)
const STAGE_PROVENANCE = {
  1: {
    pulledFrom: [{ system: 'EUR-Lex', artifact: 'DORA Art. 12' }, { system: 'Product Hub', artifact: 'Guideline v3.2' }, { system: 'Control Catalogue' }],
    processedBy: { system: 'Maya / Mitra', simulationStatus: 'simulated' as const },
    writtenTo: [{ system: 'Product Hub', artifact: 'Guideline v3.3' }, { system: 'Control Catalogue', artifact: 'BR0039-GR' }, { system: 'Evidence' }],
    proof: 'DOCX diff · CSV row diff · content hash · approval record',
  },
  2: {
    pulledFrom: [{ system: 'Control Catalogue', artifact: 'BR0039-GR' }, { system: 'IaC Repository', artifact: 'main.tf' }],
    processedBy: { system: 'Copilot', simulationStatus: 'simulated' as const },
    writtenTo: [{ system: 'GitHub / Azure DevOps', artifact: 'backup.tf (PR)' }, { system: 'Azure OneCloud' }, { system: 'Evidence' }],
    proof: 'Commit SHA · PR approval record · deployment state diff',
  },
  3: {
    pulledFrom: [{ system: 'Azure Policy', artifact: 'POL-BACKUP-001/002' }, { system: 'Azure APIs', artifact: 'Resource state' }],
    processedBy: { system: 'Azure Policy Engine', simulationStatus: 'simulated' as const },
    writtenTo: [{ system: 'Policy evaluation store' }, { system: 'DDCR', artifact: 'Alert' }],
    proof: 'Policy evaluation JSON · resource state before/after hash',
  },
  4: {
    pulledFrom: [{ system: 'Azure APIs' }, { system: 'Azure Policy', artifact: 'Evaluation result' }],
    processedBy: { system: 'AoC integration', simulationStatus: 'live' as const },
    writtenTo: [{ system: 'DDCR', artifact: 'Backup Job Configuration' }, { system: 'DDCR history' }],
    proof: 'DDCR CSV row diff · policy evaluation traceability link',
  },
  5: {
    pulledFrom: [{ system: 'Azure OneCloud' }, { system: 'IaC Repository', artifact: 'backup.tf' }, { system: 'Product Hub', artifact: 'SDD v1, OM v1' }],
    processedBy: { system: 'Maya Doc Gen', simulationStatus: 'simulated' as const },
    writtenTo: [{ system: 'Product Hub', artifact: 'SDD v2, OM v2' }, { system: 'Evidence' }],
    proof: 'DOCX diff · version hash · approval record',
  },
  6: {
    pulledFrom: [{ system: 'DORA' }, { system: 'Guidelines' }, { system: 'Control Catalogue' }, { system: 'DDCR' }, { system: 'Product Hub' }],
    processedBy: { system: 'RQMT / HCL', simulationStatus: 'simulated' as const },
    writtenTo: [{ system: 'Evidence manifest' }, { system: 'Product Hub', artifact: 'Audit response DOCX' }],
    proof: 'Full evidence chain · traceability IDs · content hashes',
  },
} as const

// ─── Platform Tour steps ───────────────────────────────────────────────────────

interface TourStep {
  number: number
  title: string
  presenterNote: string
  link: string
}

const PLATFORM_TOUR_STEPS: TourStep[] = [
  {
    number: 1,
    title: 'Executive Dashboard',
    presenterNote: 'We start with the board-level view. Across all five products and four regulations — DORA, NIS2, GDPR, and the EU AI Act — the dashboard shows real-time compliance status. One product is fully compliant, three are in remediation, and there is one pending regulatory update that requires attention.',
    link: '/dashboard',
  },
  {
    number: 2,
    title: 'Regulatory Change Detected',
    presenterNote: 'Munich Re subscribes to EUR-Lex. When DORA published a Q1 2025 amendment, the system automatically ingested it and flagged it as a pending update in the Compliance Hub. The amber banner tells the compliance team there is something to act on — before a regulator asks about it.',
    link: '/compliance-hub',
  },
  {
    number: 3,
    title: 'AI Gap Analysis',
    presenterNote: 'For each regulatory requirement, the AI reads both the obligation text and Munich Re\'s internal policy documents, then identifies gaps. In seconds it produces a structured gap register with severity ratings, gap types, and affected documents — the same analysis that would take a compliance analyst days to produce manually.',
    link: '/compliance-hub/regulations',
  },
  {
    number: 4,
    title: 'Remediation Case Workflow',
    presenterNote: 'Each gap triggers a remediation case — a structured work item assigned to the right team. The system tracks status from Open through In Progress to Resolved, links to the originating gap and regulation, and lets the AI suggest a concrete action plan with effort estimates and blockers.',
    link: '/remediation',
  },
  {
    number: 5,
    title: 'Verification & Evidence',
    presenterNote: 'When remediation work is complete, the verification engine runs automated checks against the product. Technical policies, document approvals, and workflow evidence are evaluated. Results are assembled into an evidence package that sits at the centre of the DDCR gate — nothing advances without passing all mandatory criteria.',
    link: '/ddcr',
  },
  {
    number: 6,
    title: 'Multi-Regulation DDCR',
    presenterNote: 'The DDCR dashboard gives the full picture across every product and regulation simultaneously. When all four evidence gates pass — complete package, verifications passed, no open gaps, published control change — the system transitions the requirement to COMPLIANT. This is the defensible, auditable record that regulators expect.',
    link: '/ddcr',
  },
]

interface DemoData { state: string; stageNumber: number }

// ─── Page component ───────────────────────────────────────────────────────────

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState<'platform-tour' | 'dora-journey'>('platform-tour')
  const [data, setData] = useState<DemoData | null>(null)
  const [activeStage, setActiveStage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [approvalOpen, setApprovalOpen] = useState(false)
  const [approvalApiPath, setApprovalApiPath] = useState('')
  const [technicalOpen, setTechnicalOpen] = useState(false)

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/demo/state')
    setData(await res.json())
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const stage = STAGES[activeStage - 1]
  const provenance = STAGE_PROVENANCE[activeStage as keyof typeof STAGE_PROVENANCE]

  const runAction = async (apiPath: string, label: string) => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(apiPath, { method: 'POST' })
      const d = await res.json()
      setResult(d.error ? `Error: ${d.error}` : `${label} — state: ${d.newState}`)
      await fetchData()
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async (decision: 'approved' | 'rejected', comment: string, reviewer: string) => {
    setLoading(true)
    try {
      const res = await fetch(approvalApiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reviewerComment: comment, reviewerName: reviewer }),
      })
      const d = await res.json()
      setResult(`${decision} — state: ${d.newState}`)
      await fetchData()
    } finally {
      setLoading(false)
      setApprovalOpen(false)
    }
  }

  const canPropose = data ? (stage.canProposeStates?.includes(data.state) ?? false) : false
  const canApprove = data ? (stage.canApproveStates?.includes(data.state) ?? false) : false
  const canAction = data ? (stage.canActionStates?.includes(data.state) ?? false) : false
  const isStepDone = data
    ? (stage.number < data.stageNumber || data.state === 'DOCS_APPROVED')
    : false

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--mr-vibrant-blue)' }}>
            Board Demo
          </p>
          <h1 className="text-xl font-bold" style={{ color: 'var(--mr-midnight-blue)' }}>
            AoC Control Line — Live Demonstration
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--mr-light-grey)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              State: <span className="font-semibold" style={{ color: 'var(--mr-midnight-blue)' }}>{data.state}</span>
            </span>
          )}
          <Link href="/" className="text-xs" style={{ color: 'var(--mr-vibrant-blue)' }}>
            ← Journey
          </Link>
        </div>
      </div>

      {/* ── Tab toggle ──────────────────────────────────────────────── */}
      <div
        className="inline-flex rounded-lg p-1"
        style={{ background: 'var(--mr-light-grey)', border: '1px solid var(--color-border)' }}
      >
        <button
          onClick={() => setActiveTab('platform-tour')}
          className="px-4 py-1.5 text-sm font-medium rounded-md transition-colors"
          style={{
            background: activeTab === 'platform-tour' ? '#003781' : 'transparent',
            color: activeTab === 'platform-tour' ? '#ffffff' : 'var(--color-text-secondary)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Platform Tour
        </button>
        <button
          onClick={() => setActiveTab('dora-journey')}
          className="px-4 py-1.5 text-sm font-medium rounded-md transition-colors"
          style={{
            background: activeTab === 'dora-journey' ? '#003781' : 'transparent',
            color: activeTab === 'dora-journey' ? '#ffffff' : 'var(--color-text-secondary)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          DORA Journey
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          PLATFORM TOUR TAB
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'platform-tour' && (
        <div className="space-y-5">
          {/* Intro */}
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--mr-midnight-blue)' }}>
              A walkthrough of the multi-regulation compliance platform for Munich Re stakeholders.
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Click &ldquo;Open in App &rarr;&rdquo; on each step to navigate to the live feature.
            </p>
          </div>

          {/* 2-column card grid */}
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}
          >
            {PLATFORM_TOUR_STEPS.map((step) => (
              <div
                key={step.number}
                className="bg-white flex flex-col"
                style={{
                  border: '1px solid #D0D7E3',
                  borderRadius: '10px',
                  padding: '24px',
                }}
              >
                {/* Top row: badge + title */}
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#003781',
                    }}
                  >
                    {step.number}
                  </span>
                  <h3 className="text-sm font-bold" style={{ color: '#003781' }}>
                    {step.title}
                  </h3>
                </div>

                {/* Presenter note */}
                <p
                  className="flex-1 leading-relaxed mb-4"
                  style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}
                >
                  {step.presenterNote}
                </p>

                {/* Open in App button */}
                <div>
                  <Link
                    href={step.link}
                    className="inline-block px-3 py-1.5 text-xs font-medium rounded transition-colors"
                    style={{
                      border: '1px solid #003781',
                      color: '#003781',
                      textDecoration: 'none',
                      background: 'transparent',
                    }}
                  >
                    Open in App &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          DORA JOURNEY TAB
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'dora-journey' && (
        <>
          {/* ── Six-step progress navigator ──────────────────────────────── */}
          {data && (
            <div
              className="bg-white p-4"
              style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}
            >
              <StateIndicator
                currentStage={data.stageNumber}
                demoState={data.state}
                selectedStage={activeStage}
                onStageClick={n => { setActiveStage(n); setResult(null); setTechnicalOpen(false) }}
              />
            </div>
          )}

          {/* ── Step content ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-5">
            {/* Left: step card (2/3 width) */}
            <div className="col-span-2 space-y-4">
              <div
                className="bg-white"
                style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}
              >
                {/* Step header */}
                <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--mr-vibrant-blue)' }}>
                    Step {stage.number}
                  </p>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--mr-midnight-blue)' }}>
                    {stage.title}
                  </h2>
                </div>

                {/* Provenance strip */}
                <div className="px-6 pt-4">
                  <ProvenanceStrip {...provenance} />
                </div>

                {/* Action area */}
                <div className="px-6 pb-4 flex flex-wrap items-center gap-3">
                  {stage.apiPropose && canPropose && (
                    <button
                      onClick={() => runAction(stage.apiPropose!, 'Proposal generated')}
                      disabled={loading}
                      className="px-4 py-2 text-sm font-medium rounded text-white disabled:opacity-50 transition-colors"
                      style={{ background: 'var(--mr-vibrant-blue)', border: 'none', cursor: 'pointer' }}
                    >
                      {loading ? 'Generating…' : 'Generate (AI)'}
                    </button>
                  )}
                  {stage.apiApprove && canApprove && (
                    <button
                      onClick={() => { setApprovalApiPath(stage.apiApprove!); setApprovalOpen(true) }}
                      className="px-4 py-2 text-sm font-medium rounded text-white transition-colors"
                      style={{ background: 'var(--color-success)', border: 'none', cursor: 'pointer' }}
                    >
                      Review &amp; Approve
                    </button>
                  )}
                  {stage.apiAction && canAction && (
                    <button
                      onClick={() => runAction(stage.apiAction!, 'Action complete')}
                      disabled={loading}
                      className="px-4 py-2 text-sm font-medium rounded text-white disabled:opacity-50 transition-colors"
                      style={{ background: 'var(--mr-vibrant-blue)', border: 'none', cursor: 'pointer' }}
                    >
                      {loading ? 'Running…' : 'Execute'}
                    </button>
                  )}
                  {stage.isAudit && (
                    <Link
                      href="/audit"
                      className="px-4 py-2 text-sm font-medium rounded text-white"
                      style={{ background: 'var(--mr-vibrant-blue)', textDecoration: 'none' }}
                    >
                      Open Audit Evidence →
                    </Link>
                  )}
                  <Link
                    href={`/stages/${stage.number}`}
                    className="text-xs ml-auto"
                    style={{ color: 'var(--mr-vibrant-blue)' }}
                  >
                    View full detail →
                  </Link>
                </div>

                {/* Result feedback */}
                {result && (
                  <div
                    className="mx-6 mb-4 p-3 rounded text-xs"
                    style={{
                      background: result.startsWith('Error') ? 'rgba(192,57,43,0.08)' : 'rgba(26,124,89,0.08)',
                      color: result.startsWith('Error') ? 'var(--color-danger)' : 'var(--color-success)',
                      border: `1px solid ${result.startsWith('Error') ? 'rgba(192,57,43,0.25)' : 'rgba(26,124,89,0.25)'}`,
                    }}
                  >
                    {result}
                  </div>
                )}

                {/* Step completion summary */}
                {isStepDone && (
                  <div
                    className="mx-6 mb-4 p-3 rounded text-xs space-y-1"
                    style={{ background: 'rgba(26,124,89,0.06)', border: '1px solid rgba(26,124,89,0.2)' }}
                  >
                    <p className="font-semibold" style={{ color: 'var(--color-success)' }}>
                      ✓ Step {stage.number} completed
                    </p>
                    <p style={{ color: 'var(--color-text-secondary)' }}>
                      <span className="font-medium" style={{ color: 'var(--mr-midnight-blue)' }}>Source: </span>
                      {stage.completionSummary.source}
                    </p>
                    <p style={{ color: 'var(--color-text-secondary)' }}>
                      <span className="font-medium" style={{ color: 'var(--mr-midnight-blue)' }}>Change: </span>
                      {stage.completionSummary.change}
                    </p>
                    <p style={{ color: 'var(--color-text-secondary)' }}>
                      <span className="font-medium" style={{ color: 'var(--mr-midnight-blue)' }}>Evidence: </span>
                      {stage.completionSummary.evidence}
                    </p>
                  </div>
                )}

                {/* Technical details — collapsed by default */}
                <div
                  className="mx-6 mb-4"
                  style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}
                >
                  <button
                    onClick={() => setTechnicalOpen(o => !o)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs transition-colors"
                    style={{
                      background: technicalOpen ? 'var(--mr-light-grey)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <span className="font-medium">Technical details</span>
                    <span>{technicalOpen ? '▲' : '▼'}</span>
                  </button>
                  {technicalOpen && (
                    <div
                      className="px-3 pb-3 text-xs space-y-2"
                      style={{
                        borderTop: '1px solid var(--color-border)',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--color-text-secondary)',
                        paddingTop: '0.5rem',
                      }}
                    >
                      <div>
                        <span className="font-semibold not-italic" style={{ fontFamily: 'var(--font-sans)' }}>System state: </span>
                        {data?.state ?? '—'}
                      </div>
                      <div>
                        <span className="font-semibold not-italic" style={{ fontFamily: 'var(--font-sans)' }}>Stage number: </span>
                        {data?.stageNumber ?? '—'}
                      </div>
                      <div>
                        <span className="font-semibold not-italic" style={{ fontFamily: 'var(--font-sans)' }}>Can propose: </span>
                        {String(canPropose)}
                        {' · '}
                        <span className="font-semibold not-italic" style={{ fontFamily: 'var(--font-sans)' }}>Can approve: </span>
                        {String(canApprove)}
                        {' · '}
                        <span className="font-semibold not-italic" style={{ fontFamily: 'var(--font-sans)' }}>Can action: </span>
                        {String(canAction)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: presenter notes (1/3 width) */}
            <div
              className="rounded-lg p-5"
              style={{
                background: 'var(--mr-light-blue)',
                border: '1px solid var(--color-border)',
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--mr-midnight-blue)' }}>
                Presenter Note
              </p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--mr-midnight-blue)', opacity: 0.8 }}>
                {stage.presenterNote}
              </p>
            </div>
          </div>

          {/* ── Prev / Next ──────────────────────────────────────────────── */}
          <div className="flex justify-between">
            <button
              onClick={() => { setActiveStage(s => Math.max(1, s - 1)); setResult(null); setTechnicalOpen(false) }}
              disabled={activeStage === 1}
              className="px-4 py-2 text-sm rounded disabled:opacity-30 transition-colors"
              style={{
                background: 'var(--mr-light-grey)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                cursor: activeStage === 1 ? 'default' : 'pointer',
              }}
            >
              ← Previous
            </button>

            {/* Final step: show evidence actions */}
            {activeStage === 6 && data?.state === 'DOCS_APPROVED' && (
              <div className="flex items-center gap-2">
                <Link href="/audit" className="px-3 py-1.5 text-xs font-medium rounded text-white" style={{ background: 'var(--mr-vibrant-blue)', textDecoration: 'none' }}>
                  Open complete evidence package
                </Link>
                <Link href="/evidence-centre" className="px-3 py-1.5 text-xs font-medium rounded" style={{ background: 'var(--mr-light-grey)', color: 'var(--mr-midnight-blue)', border: '1px solid var(--color-border)', textDecoration: 'none' }}>
                  Open evidence folder
                </Link>
                <Link href="/portfolio" className="px-3 py-1.5 text-xs font-medium rounded" style={{ background: 'var(--mr-light-grey)', color: 'var(--mr-midnight-blue)', border: '1px solid var(--color-border)', textDecoration: 'none' }}>
                  View portfolio status
                </Link>
              </div>
            )}

            <button
              onClick={() => { setActiveStage(s => Math.min(6, s + 1)); setResult(null); setTechnicalOpen(false) }}
              disabled={activeStage === 6}
              className="px-4 py-2 text-sm rounded disabled:opacity-30 transition-colors"
              style={{
                background: 'var(--mr-light-grey)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                cursor: activeStage === 6 ? 'default' : 'pointer',
              }}
            >
              Next →
            </button>
          </div>
        </>
      )}

      <ApprovalModal
        isOpen={approvalOpen}
        title={`Approve Step ${activeStage}: ${stage.title}`}
        description="Review and approve or reject this proposal."
        onApprove={(comment, reviewer) => handleApproval('approved', comment, reviewer)}
        onReject={(comment, reviewer) => handleApproval('rejected', comment, reviewer)}
        onClose={() => setApprovalOpen(false)}
      />
    </div>
  )
}
