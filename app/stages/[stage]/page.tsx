'use client'
import { use, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { AiBadge } from '@/components/AiBadge'
import { ApprovalModal } from '@/components/ApprovalModal'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { ProvenanceStrip } from '@/components/ProvenanceStrip'
import { DocumentViewer, type ViewerDocument } from '@/components/DocumentViewer'
import { DocumentDiff } from '@/components/DocumentDiff'
import { StageTabView } from '@/components/StageTabView'
import { clsx } from 'clsx'

interface DemoData {
  state: string
  stageNumber: number
  guidelineVersions: Array<{ id: string; version: string; content: string; proposedContent: string | null; status: string }>
  controlActivities: Array<{ id: string; code: string; title: string; objective: string; implementationStatement: string | null; status: string; isDemoData: boolean }>
  latestIacChange: { id: string; prNumber: string; commitSha: string; branchName: string; status: string; diffContent: string } | null
  latestDeployment: { id: string; status: string; simulatedAt: string; cloudStateSnapshot: Record<string, unknown> } | null
  policyEvaluations: Array<{ policyCode: string; status: string; evidence: Record<string, unknown>; evaluatedAt: string }>
  workProducts: Array<{ name: string; status: string; evidenceIds: string[] }>
  documents: Array<{ id: string; type: string; title: string; versions: Array<{ id: string; version: string; content: string; proposedContent: string | null; status: string; createdAt?: string | null; approvalId?: string | null }> }>
}

interface RegulationData {
  source: 'live' | 'fixture'
  fetchedAt: string | null
  article12Text: string
  eurLexUrl: string
  celex: string
}

// ── Data provenance per stage ──────────────────────────────────────────────

const STAGE_PROVENANCE: Record<number, {
  pulledFrom: { system: string; artifact?: string }[]
  processedBy: { system: string; simulationStatus: 'live' | 'simulated' }
  writtenTo: { system: string; artifact?: string }[]
  proof: string
}> = {
  1: {
    pulledFrom: [
      { system: 'EUR-Lex', artifact: 'DORA Article 12' },
      { system: 'Product Hub', artifact: 'Guideline v3.2' },
      { system: 'Control Catalogue' },
    ],
    processedBy: { system: 'Maya / Mitra', simulationStatus: 'simulated' },
    writtenTo: [
      { system: 'Product Hub', artifact: 'Guideline v3.3' },
      { system: 'Control Catalogue', artifact: 'BR0039-GR' },
      { system: 'Evidence', artifact: 'Approval record' },
    ],
    proof: 'DOCX diff · CSV row diff · content hash · approval record',
  },
  2: {
    pulledFrom: [
      { system: 'Control Catalogue', artifact: 'BR0039-GR (approved)' },
      { system: 'IaC Repository', artifact: 'main.tf' },
    ],
    processedBy: { system: 'Copilot', simulationStatus: 'simulated' },
    writtenTo: [
      { system: 'GitHub / Azure DevOps', artifact: 'backup.tf (PR)' },
      { system: 'Azure OneCloud' },
      { system: 'Evidence' },
    ],
    proof: 'Commit SHA · PR approval record · deployment state diff',
  },
  3: {
    pulledFrom: [
      { system: 'Azure Policy', artifact: 'POL-BACKUP-001/002' },
      { system: 'Azure APIs', artifact: 'Resource state' },
    ],
    processedBy: { system: 'Azure Policy Engine', simulationStatus: 'simulated' },
    writtenTo: [
      { system: 'Policy evaluation store', artifact: 'policy_evaluation_after.json' },
      { system: 'DDCR', artifact: 'Alert' },
    ],
    proof: 'Policy evaluation JSON · resource state before/after hash',
  },
  4: {
    pulledFrom: [
      { system: 'Azure APIs' },
      { system: 'Azure Policy', artifact: 'Evaluation result' },
    ],
    processedBy: { system: 'AoC integration', simulationStatus: 'live' },
    writtenTo: [
      { system: 'DDCR', artifact: 'Backup Job Configuration' },
      { system: 'DDCR history' },
    ],
    proof: 'DDCR CSV row diff · policy evaluation traceability link',
  },
  5: {
    pulledFrom: [
      { system: 'Azure OneCloud', artifact: 'Deployed state' },
      { system: 'IaC Repository', artifact: 'backup.tf' },
      { system: 'Product Hub', artifact: 'SDD v1, OM v1' },
    ],
    processedBy: { system: 'Maya Doc Gen', simulationStatus: 'simulated' },
    writtenTo: [
      { system: 'Product Hub', artifact: 'SDD v2, OM v2' },
      { system: 'Evidence' },
    ],
    proof: 'DOCX diff · version hash · approval record',
  },
  6: {
    pulledFrom: [
      { system: 'DORA', artifact: 'Article 12' },
      { system: 'Guidelines' },
      { system: 'Control Catalogue' },
      { system: 'Azure Policy' },
      { system: 'DDCR' },
      { system: 'Product Hub' },
    ],
    processedBy: { system: 'RQMT / HCL', simulationStatus: 'simulated' },
    writtenTo: [
      { system: 'Evidence manifest', artifact: 'manifest.json' },
      { system: 'Product Hub', artifact: 'Audit response DOCX' },
    ],
    proof: 'Full evidence chain · traceability IDs · content hashes',
  },
}

// ── Page component ─────────────────────────────────────────────────────────────

export default function StagePage({ params }: { params: Promise<{ stage: string }> }) {
  const { stage: stageParam } = use(params)
  const stage = parseInt(stageParam, 10)

  const [data, setData] = useState<DemoData | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionResult, setActionResult] = useState<{ ok: boolean; message: string; provenance?: { model: string; provider: string } } | null>(null)
  const [approvalOpen, setApprovalOpen] = useState(false)
  const [approvalConfig, setApprovalConfig] = useState({ title: '', description: '', apiPath: '' })

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/demo/state')
    const d = await res.json()
    setData(d)
  }, [])

  useEffect(() => { fetchData() }, [fetchData, stage])

  const runAction = async (apiPath: string, label: string) => {
    setLoading(true)
    setActionResult(null)
    try {
      const res = await fetch(apiPath, { method: 'POST' })
      const result = await res.json()
      if (result.error) {
        setActionResult({ ok: false, message: result.error })
      } else {
        const prov = result.guidelineProposal?.provenance || result.iacProposal?.provenance || result.docProposal?.provenance
        setActionResult({
          ok: true,
          message: `${label} complete. New state: ${result.newState}`,
          provenance: prov,
        })
        await fetchData()
      }
    } catch (err) {
      setActionResult({ ok: false, message: String(err) })
    } finally {
      setLoading(false)
    }
  }

  const openApproval = (title: string, description: string, apiPath: string) => {
    setApprovalConfig({ title, description, apiPath })
    setApprovalOpen(true)
  }

  const handleApprovalDecision = async (decision: 'approved' | 'rejected', comment: string, reviewer: string) => {
    setLoading(true)
    try {
      const res = await fetch(approvalConfig.apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reviewerComment: comment, reviewerName: reviewer }),
      })
      const result = await res.json()
      const ok = result.ok ?? !result.error
      setActionResult({ ok, message: result.error ?? `${decision}. New state: ${result.newState}` })
      await fetchData()
      // If a guided run is waiting for this approval, resume it so the main-page
      // state machine advances even when approval is done from the detail view.
      if (decision === 'approved' && ok) {
        await fetch('/api/guided-run/continue', { method: 'POST' }).catch(() => {})
      }
    } finally {
      setLoading(false)
      setApprovalOpen(false)
    }
  }

  if (!data) return <div style={{ color: 'var(--color-text-muted)' }} className="animate-pulse">Loading...</div>

  const stageProvenance = STAGE_PROVENANCE[stage]

  return (
    <div className="space-y-6">
      <div>
        {/* Stage navigator */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Link
            href="/"
            style={{
              fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)',
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            ← Overview
          </Link>
          <span style={{ color: 'var(--color-border)', fontSize: '14px' }}>|</span>
          {[1, 2, 3, 4, 5, 6].map(n => (
            <Link
              key={n}
              href={`/stages/${n}`}
              style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                textDecoration: 'none',
                background: n === stage ? 'var(--mr-vibrant-blue)' : 'var(--mr-light-grey)',
                color: n === stage ? 'white' : 'var(--color-text-secondary)',
                border: `1px solid ${n === stage ? 'var(--mr-vibrant-blue)' : 'var(--color-border)'}`,
              }}
            >
              {n}. {['Define', 'Integrate', 'Verify', 'Report', 'Document', 'Prove'][n - 1]}
            </Link>
          ))}
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--mr-midnight-blue)' }}>{stageTitle(stage)}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Current state: <span style={{ color: 'var(--mr-vibrant-blue)', fontWeight: 600 }}>{data.state}</span>
        </p>
      </div>

      {/* Data provenance strip */}
      {stageProvenance && <ProvenanceStrip {...stageProvenance} />}

      {actionResult && (
        <div className={clsx(
          'p-3 rounded-md border text-sm',
          actionResult.ok
            ? 'bg-[#1a7c59]/10 border-[#1a7c59]/30 text-[#1a7c59]'
            : 'bg-[#c0392b]/10 border-[#c0392b]/30 text-[#c0392b]'
        )}>
          {actionResult.message}
          {actionResult.provenance && (
            <div className="mt-2">
              <ProvenanceBadge provenance={{ ...actionResult.provenance, promptVersion: '1.0.0', generatedAt: new Date().toISOString() }} />
            </div>
          )}
        </div>
      )}

      {stage === 1 && <Stage1Content data={data} onAction={runAction} onApproval={openApproval} loading={loading} />}
      {stage === 2 && <Stage2Content data={data} onAction={runAction} onApproval={openApproval} loading={loading} />}
      {stage === 3 && <Stage3Content data={data} onAction={runAction} loading={loading} />}
      {stage === 4 && <Stage4Content data={data} onAction={runAction} loading={loading} />}
      {stage === 5 && <Stage5Content data={data} onAction={runAction} onApproval={openApproval} loading={loading} />}
      {stage === 6 && <Stage6Content />}

      <ApprovalModal
        isOpen={approvalOpen}
        title={approvalConfig.title}
        description={approvalConfig.description}
        onApprove={(comment, reviewer) => handleApprovalDecision('approved', comment, reviewer)}
        onReject={(comment, reviewer) => handleApprovalDecision('rejected', comment, reviewer)}
        onClose={() => setApprovalOpen(false)}
      />
    </div>
  )
}

function stageTitle(stage: number): string {
  return [
    'Define Backup Standards & Controls',
    'Integrate Backup Controls',
    'Verify Backup Control Fulfilment',
    'Report Backup Control Fulfilment',
    'Document Backup Control Fulfilment',
    'Prove Backup Control Fulfilment',
  ][stage - 1] ?? `Stage ${stage}`
}

// ── Stage 1 ──

function Stage1Content({ data, onAction, onApproval, loading }: { data: DemoData; onAction: (path: string, label: string) => void; onApproval: (title: string, desc: string, path: string) => void; loading: boolean }) {
  const v33 = data.guidelineVersions.find(v => v.version === '3.3')
  const v32 = data.guidelineVersions.find(v => v.version === '3.2')
  const control = data.controlActivities.find(c => c.code === 'BR0039-GR')
  const canPropose = data.state === 'BASELINE'
  const canApprove = data.state === 'STANDARD_PROPOSED'

  const [ingestDone, setIngestDone] = useState(false)
  const [ingestLoading, setIngestLoading] = useState(false)
  const [ingestResult, setIngestResult] = useState<{ normalizedFiles: string[] } | null>(null)

  const runIngest = async () => {
    setIngestLoading(true)
    try {
      const res = await fetch('/api/stage/1/ingest', { method: 'POST' })
      const d = await res.json() as { ok: boolean; normalizedFiles?: string[]; results?: Array<{ file: string }>; message?: string }
      if (d.ok) {
        setIngestDone(true)
        const files = d.normalizedFiles ?? d.results?.map(r => r.file) ?? []
        setIngestResult({ normalizedFiles: files })
      }
    } finally {
      setIngestLoading(false)
    }
  }

  const [regulation, setRegulation] = useState<RegulationData | null>(null)
  const [regLoading, setRegLoading] = useState(false)

  const fetchRegulation = useCallback(async () => {
    setRegLoading(true)
    try {
      const res = await fetch('/api/regulation/dora-art-12')
      if (res.ok) setRegulation(await res.json() as RegulationData)
    } finally {
      setRegLoading(false)
    }
  }, [])

  useEffect(() => { fetchRegulation() }, [fetchRegulation])

  const stage1Approved = ['STANDARD_APPROVED', 'IAC_PR_CREATED', 'DEPLOYED', 'POLICY_VERIFIED', 'DDCR_UPDATED', 'DOCS_PROPOSED', 'DOCS_APPROVED'].includes(data.state)

  return (
    <div className="space-y-6">
      {/* Step 1a: Read Sources */}
      <div className="bg-white border border-[#D0D7E3] rounded-lg p-5" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
        <p className="text-[#003781] text-xs font-semibold uppercase mb-2">Step 1a: Read Sources</p>
        <p className="text-[#4A5568] text-sm mb-3">Parse raw source files and write normalized data before proposing changes.</p>
        <div className="flex items-center gap-3">
          <button
            onClick={runIngest}
            disabled={ingestLoading || ingestDone}
            className="px-4 py-2 bg-[#0066B2] hover:bg-[#003781] text-white text-sm rounded-md font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {ingestLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Reading...
              </>
            ) : ingestDone ? (
              <>&#10003; Sources Read</>
            ) : (
              'Read Sources'
            )}
          </button>
          {ingestDone && ingestResult && ingestResult.normalizedFiles.length > 0 && (
            <div className="text-xs text-[#0A7C59]">
              Created: {ingestResult.normalizedFiles.join(', ')}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {canPropose && (
          <button
            onClick={() => onAction('/api/stage/1/propose', 'Stage 1 proposal')}
            disabled={loading}
            className="px-4 py-2 bg-[#003781] hover:bg-[#0066B2] text-white text-sm rounded-md font-medium disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Guideline & Control Proposal (AI)'}
          </button>
        )}
        {canApprove && (
          <button
            onClick={() => onApproval('Approve Guideline v3.3 & Control BR0039-GR', 'Review the proposed guideline update and control activity before approving.', '/api/stage/1/approve')}
            className="px-4 py-2 bg-[#0A7C59] hover:bg-[#0A7C59]/90 text-white text-sm rounded-md font-medium"
          >
            Review & Approve
          </button>
        )}
      </div>

      {/* EUR-Lex Regulation Panel */}
      <div className="bg-white border border-[#D0D7E3] rounded-lg p-6" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[#1A1A2E] font-semibold">DORA Article 12 — Regulatory Source</h2>
          <div className="flex items-center gap-2">
            {regulation && (
              regulation.source === 'live'
                ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[#0A7C59]/10 text-[#0A7C59] text-xs rounded-full border border-[#0A7C59]/30 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0A7C59] animate-pulse" />
                    Live from EUR-Lex
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F4F6F9] text-[#4A5568] text-xs rounded-full border border-[#D0D7E3]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4A5568]" />
                    Cached fixture
                  </span>
                )
            )}
            <button
              onClick={fetchRegulation}
              disabled={regLoading}
              className="px-3 py-1 text-xs bg-[#003781]/10 hover:bg-[#003781]/20 text-[#003781] border border-[#003781]/30 rounded-md transition-colors disabled:opacity-50"
            >
              {regLoading ? 'Fetching…' : 'Refresh from EUR-Lex'}
            </button>
          </div>
        </div>

        {regulation ? (
          <>
            {regulation.fetchedAt && (
              <p className="text-[#4A5568]/70 text-xs mb-3">
                Fetched at: {new Date(regulation.fetchedAt).toLocaleString()} ·{' '}
                <a
                  href={regulation.eurLexUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#003781] hover:underline"
                >
                  CELEX {regulation.celex}
                </a>
              </p>
            )}
            <div className="bg-[#F4F6F9] border border-[#D0D7E3] rounded-lg p-4 max-h-64 overflow-y-auto">
              <p className="text-[#4A5568] text-xs whitespace-pre-wrap leading-relaxed">{regulation.article12Text}</p>
            </div>
          </>
        ) : (
          <div className="bg-[#F4F6F9] border border-[#D0D7E3] rounded-lg p-4 text-center">
            <p className="text-[#4A5568] text-sm">{regLoading ? 'Loading regulation…' : 'Unable to load regulation data'}</p>
          </div>
        )}
      </div>

      {/* Guideline diff */}
      <div className="bg-white border border-[#D0D7E3] rounded-lg p-6" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
        <h2 className="text-[#1A1A2E] font-semibold mb-4">BR Guideline: v3.2 → v3.3 Proposal</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-[#F4F6F9] text-[#4A5568] text-xs rounded border border-[#D0D7E3]">v3.2 Current</span>
            </div>
            <pre className="bg-[#F4F6F9] border border-[#D0D7E3] rounded-lg p-4 text-xs text-[#4A5568] overflow-auto max-h-80 whitespace-pre-wrap">
              {v32?.content ?? 'Loading...'}
            </pre>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={clsx('px-2 py-0.5 text-xs rounded border', v33?.status === 'approved' ? 'bg-[#0A7C59]/10 text-[#0A7C59] border-[#0A7C59]/30' : 'bg-[#003781]/10 text-[#003781] border-[#003781]/30')}>
                v3.3 {v33?.status === 'approved' ? 'Approved' : 'Proposed'}
              </span>
              {(v33?.proposedContent || v33?.content) && <AiBadge />}
            </div>
            <pre className="bg-[#F4F6F9] border border-[#D0D7E3] rounded-lg p-4 text-xs text-[#0A7C59] overflow-auto max-h-80 whitespace-pre-wrap">
              {v33?.proposedContent ?? v33?.content ?? 'Not yet generated — click "Generate" above'}
            </pre>
          </div>
        </div>
      </div>

      {/* Control Activity */}
      <div className="bg-white border border-[#D0D7E3] rounded-lg p-6" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[#1A1A2E] font-semibold">Control Activity Proposal</h2>
            {control && <AiBadge />}
          </div>
          {control?.isDemoData && (
            <span className="px-2 py-0.5 bg-[#B45309]/10 text-[#B45309] text-xs rounded border border-[#B45309]/30">[DEMO DATA]</span>
          )}
        </div>
        {control ? (
          <div className="space-y-3">
            <ControlField label="Code" value={control.code} />
            <ControlField label="Title" value={control.title} />
            <ControlField label="Objective" value={control.objective} />
            {control.implementationStatement && <ControlField label="Implementation" value={control.implementationStatement} />}
            <div className="flex items-center gap-2 mt-2">
              <span className={clsx('px-2 py-0.5 text-xs rounded border',
                control.status === 'approved' ? 'bg-[#0A7C59]/10 text-[#0A7C59] border-[#0A7C59]/30' :
                control.status === 'proposed' ? 'bg-[#003781]/10 text-[#003781] border-[#003781]/30' :
                'bg-[#F4F6F9] text-[#4A5568] border-[#D0D7E3]'
              )}>
                {control.status}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-[#4A5568] text-sm">Not yet generated</p>
        )}
      </div>

      {/* File tab view */}
      <StageTabView
        stageNumber={1}
        originalSources={[
          { label: 'DORA Article 12', path: 'data/raw/eurlex/dora_article_12.html', format: 'html', description: 'EUR-Lex regulatory source — backup requirements' },
          { label: 'Backup & Restore Guideline v3.2', path: 'data/raw/guidelines/Backup_Restore_Guideline_v3.2.docx', format: 'docx', description: 'Current internal backup & restore guideline' },
        ]}
        parsedDataPaths={['data/normalized/eurlex_article12.json', 'data/normalized/guideline_v32.json']}
        generatedFiles={[
          { label: 'Backup & Restore Guideline v3.3', path: 'data/generated/guidelines/Backup_Restore_Guideline_v3.3.docx', format: 'docx', exists: stage1Approved, description: 'Updated guideline with GRZ requirement' },
          { label: 'Control Catalog (BR0039-GR)', path: 'data/generated/controls/BR0039-GR_catalog.csv', format: 'csv', exists: stage1Approved, description: 'New control activity mapping regulation to automated test' },
        ]}
        diffView={v32 && v33 ? <DocumentDiff currentContent={v32.content} proposedContent={v33.proposedContent ?? v33.content} /> : undefined}
        evidenceFilter="stage-1"
      />
    </div>
  )
}

function ControlField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[#4A5568] text-xs mb-0.5">{label}</dt>
      <dd className="text-[#1A1A2E] text-sm">{value}</dd>
    </div>
  )
}

// ── Stage 2 ──

function Stage2Content({ data, onAction, onApproval, loading }: { data: DemoData; onAction: (path: string, label: string) => void; onApproval: (title: string, desc: string, path: string) => void; loading: boolean }) {
  const canPropose = data.state === 'STANDARD_APPROVED'
  const canApprove = data.state === 'IAC_PR_CREATED'
  const iac = data.latestIacChange
  const deployment = data.latestDeployment
  const stage2Approved = ['DEPLOYED', 'POLICY_VERIFIED', 'DDCR_UPDATED', 'DOCS_PROPOSED', 'DOCS_APPROVED'].includes(data.state)

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        {canPropose && (
          <button
            onClick={() => onAction('/api/stage/2/propose', 'IaC proposal')}
            disabled={loading}
            className="px-4 py-2 bg-[#003781] hover:bg-[#0066B2] text-white text-sm rounded-md font-medium disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate IaC Change (AI)'}
          </button>
        )}
        {canApprove && (
          <button
            onClick={() => onApproval('Approve IaC PR & Deployment', `Review PR ${iac?.prNumber} and approve simulated deployment.`, '/api/stage/2/approve')}
            className="px-4 py-2 bg-[#0A7C59] hover:bg-[#0A7C59]/90 text-white text-sm rounded-md font-medium"
          >
            Review PR & Approve Deployment
          </button>
        )}
      </div>

      {iac && (
        <div className="bg-white border border-[#D0D7E3] rounded-lg p-6" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-[#1A1A2E] font-semibold">Pull Request: {iac.prNumber}</h2>
              <AiBadge />
            </div>
            <div className="flex items-center gap-2">
              <span className={clsx('px-2 py-0.5 text-xs rounded border',
                iac.status === 'merged' ? 'bg-[#003781]/10 text-[#003781] border-[#003781]/30' :
                iac.status === 'approved' ? 'bg-[#0A7C59]/10 text-[#0A7C59] border-[#0A7C59]/30' :
                'bg-[#B45309]/10 text-[#B45309] border-[#B45309]/30'
              )}>
                {iac.status}
              </span>
              <code className="text-[#4A5568] text-xs">{iac.commitSha}</code>
            </div>
          </div>
          <p className="text-[#4A5568] text-xs mb-3">Branch: <code className="text-[#003781]">{iac.branchName}</code></p>
          <pre className="bg-[#F4F6F9] border border-[#D0D7E3] rounded-lg p-4 text-xs text-[#0A7C59] overflow-auto max-h-96 whitespace-pre-wrap font-mono">
            {iac.diffContent}
          </pre>
        </div>
      )}

      {deployment && (
        <div className="bg-white border border-[#D0D7E3] rounded-lg p-6" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
          <h2 className="text-[#1A1A2E] font-semibold mb-4">Simulated Deployment</h2>
          <div className="flex items-center gap-3 mb-4">
            <span className={clsx('px-3 py-1 rounded-full text-xs font-medium border',
              deployment.status === 'succeeded' ? 'bg-[#0A7C59]/10 text-[#0A7C59] border-[#0A7C59]/30' :
              'bg-[#B45309]/10 text-[#B45309] border-[#B45309]/30'
            )}>
              {deployment.status.toUpperCase()}
            </span>
            <span className="text-[#4A5568] text-xs">{deployment.simulatedAt}</span>
            <span className="text-[#B45309] text-xs font-medium">SIMULATED — No actual Azure resources modified</span>
          </div>
          <div className="space-y-2">
            {(deployment.cloudStateSnapshot as { resources?: Array<{ type: string; name: string }> })?.resources?.map((r, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="w-2 h-2 rounded-full bg-[#0A7C59] flex-shrink-0" />
                <code className="text-[#4A5568] text-xs">{r.type}</code>
                <code className="text-[#1A1A2E] text-xs">{r.name}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      {!iac && (
        <div className="bg-[#F4F6F9] border border-dashed border-[#D0D7E3] rounded-lg p-8 text-center">
          <p className="text-[#4A5568] text-sm">IaC change not yet generated</p>
          {data.state !== 'STANDARD_APPROVED' && (
            <p className="text-[#4A5568]/60 text-xs mt-1">Complete Stage 1 first</p>
          )}
        </div>
      )}

      <StageTabView
        stageNumber={2}
        originalSources={[
          { label: 'Control BR0039-GR', path: 'data/generated/controls/BR0039-GR_catalog.csv', format: 'csv', description: 'Approved control specification driving IaC' },
        ]}
        parsedDataPaths={['data/normalized/control_br0039gr.json']}
        generatedFiles={[
          { label: 'backup.tf', path: 'infra/modules/backup/backup.tf', format: 'tf', exists: stage2Approved, description: 'Terraform for geo-redundant Recovery Services Vault' },
        ]}
        diffView={iac?.diffContent ? <DocumentDiff currentContent="" proposedContent={iac.diffContent} /> : undefined}
        evidenceFilter="stage-2"
      />
    </div>
  )
}

// ── Stage 3 ──

function Stage3BeforeAfterPanel({ data }: { data: DemoData }) {
  const hasDeployed = ['DEPLOYED', 'POLICY_VERIFIED', 'DDCR_UPDATED', 'DOCS_PROPOSED', 'DOCS_APPROVED'].includes(data.state)
  const pol1 = data.policyEvaluations.find(e => e.policyCode === 'POL-BACKUP-001')
  const pol2 = data.policyEvaluations.find(e => e.policyCode === 'POL-BACKUP-002')
  const hasEvaluations = data.policyEvaluations.length > 0
  return (
    <div className="bg-white border border-[#D0D7E3] rounded-lg p-6" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
      <h2 className="text-[#1A1A2E] font-semibold mb-4">Resource State — Before vs. After Deployment</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-[#D0D7E3] rounded-lg p-4 bg-[#F4F6F9]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[#1A1A2E] text-sm font-medium">Before (Baseline)</p>
            <span className="px-2 py-0.5 text-xs rounded border bg-[#F4F6F9] text-[#4A5568] border-[#D0D7E3]">BASELINE</span>
          </div>
          <code className="text-xs text-[#4A5568] font-mono block mb-3">data/raw/azure/it_app_x_resources_before.json</code>
          <div className="space-y-1.5 text-xs mb-3">
            <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#4A5568]" /><span className="text-[#4A5568]">VM (backup: disabled)</span></div>
            <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#4A5568]" /><span className="text-[#4A5568]">Storage Account (LRS)</span></div>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2"><span className="text-[#E4002B]">&#10007;</span><span className="text-[#4A5568]">POL-BACKUP-001: NonCompliant</span></div>
            <div className="flex items-center gap-2"><span className="text-[#E4002B]">&#10007;</span><span className="text-[#4A5568]">POL-BACKUP-002: NonCompliant</span></div>
          </div>
        </div>
        <div className={`border rounded-lg p-4 ${hasDeployed ? 'border-[#0A7C59]/30 bg-[#0A7C59]/5' : 'border-[#D0D7E3] bg-[#F4F6F9]'}`}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[#1A1A2E] text-sm font-medium">After (Post-deployment)</p>
            {hasDeployed
              ? <span className="px-2 py-0.5 text-xs rounded border bg-[#003781]/10 text-[#003781] border-[#003781]/30">GENERATED</span>
              : <span className="px-2 py-0.5 text-xs rounded border text-[#E4002B] border-[#E4002B]/30">NOT YET CREATED</span>
            }
          </div>
          <code className="text-xs text-[#4A5568] font-mono block mb-3">data/generated/azure/it_app_x_resources_after.json</code>
          {hasDeployed ? (
            <>
              <div className="space-y-1.5 text-xs mb-3">
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#0A7C59]" /><span className="text-[#4A5568]">VM (backup: enabled)</span></div>
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#0A7C59]" /><span className="text-[#4A5568]">Recovery Services Vault (GeoRedundant)</span></div>
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#0A7C59]" /><span className="text-[#4A5568]">BackupProtectedItem</span></div>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className={hasEvaluations && pol1?.status === 'Compliant' ? 'text-[#0A7C59]' : 'text-[#4A5568]'}>
                    {hasEvaluations && pol1?.status === 'Compliant' ? '✓' : '○'}
                  </span>
                  <span className="text-[#4A5568]">POL-BACKUP-001: {hasEvaluations ? (pol1?.status ?? 'Pending') : 'Pending evaluation'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={hasEvaluations && pol2?.status === 'Compliant' ? 'text-[#0A7C59]' : 'text-[#4A5568]'}>
                    {hasEvaluations && pol2?.status === 'Compliant' ? '✓' : '○'}
                  </span>
                  <span className="text-[#4A5568]">POL-BACKUP-002: {hasEvaluations ? (pol2?.status ?? 'Pending') : 'Pending evaluation'}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <svg className="w-8 h-8 text-[#4A5568]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-[#4A5568] text-xs">Deploy first to generate after-state</p>
              <p className="text-[#4A5568]/60 text-xs">Complete Stage 2 and run deployment</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stage3Content({ data, onAction, loading }: { data: DemoData; onAction: (path: string, label: string) => void; loading: boolean }) {
  const canEvaluate = data.state === 'DEPLOYED'
  const stage3Done = ['POLICY_VERIFIED', 'DDCR_UPDATED', 'DOCS_PROPOSED', 'DOCS_APPROVED'].includes(data.state)

  const statusColor = (s: string) =>
    s === 'Compliant' ? 'text-[#0A7C59]' : s === 'NonCompliant' ? 'text-[#E4002B]' : 'text-[#4A5568]'

  return (
    <div className="space-y-6">
      {canEvaluate && (
        <button
          onClick={() => onAction('/api/stage/3/evaluate', 'Policy evaluation')}
          disabled={loading}
          className="px-4 py-2 bg-[#003781] hover:bg-[#0066B2] text-white text-sm rounded-md font-medium disabled:opacity-50"
        >
          {loading ? 'Evaluating...' : 'Run Policy Evaluation'}
        </button>
      )}

      <div className="bg-white border border-[#D0D7E3] rounded-lg p-6" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
        <h2 className="text-[#1A1A2E] font-semibold mb-4">Azure Policy Evaluation — Simulated</h2>
        {data.policyEvaluations.length === 0 ? (
          <p className="text-[#4A5568] text-sm">No evaluations yet</p>
        ) : (
          <div className="space-y-3">
            {data.policyEvaluations.map(eval_ => (
              <div key={eval_.policyCode} className="flex items-center justify-between p-3 bg-[#F4F6F9] rounded-md border border-[#D0D7E3]">
                <div>
                  <span className="text-[#1A1A2E] text-sm font-medium">{eval_.policyCode}</span>
                  <p className="text-[#4A5568] text-xs mt-0.5">{eval_.evaluatedAt}</p>
                </div>
                <span className={clsx('text-sm font-semibold', statusColor(eval_.status))}>
                  {eval_.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Stage3BeforeAfterPanel data={data} />

      <StageTabView
        stageNumber={3}
        originalSources={[
          { label: 'Azure Resources (Before)', path: 'data/raw/azure/it_app_x_resources_before.json', format: 'json', description: 'Baseline cloud state before backup deployment' },
          { label: 'Policy Definitions', path: 'data/raw/policies/POL-BACKUP-001.json', format: 'json', description: 'Azure Policy definition for backup compliance' },
        ]}
        parsedDataPaths={['data/normalized/azure_resources_before.json']}
        generatedFiles={[
          { label: 'Azure Resources (After)', path: 'data/generated/azure/it_app_x_resources_after.json', format: 'json', exists: stage3Done, description: 'Post-deployment cloud state with backup enabled' },
        ]}
        evidenceFilter="stage-3"
      />
    </div>
  )
}

// ── Stage 4 ──

function Stage4Content({ data, onAction, loading }: { data: DemoData; onAction: (path: string, label: string) => void; loading: boolean }) {
  const canUpdate = data.state === 'POLICY_VERIFIED'
  const stage4Done = ['DDCR_UPDATED', 'DOCS_PROPOSED', 'DOCS_APPROVED'].includes(data.state)

  return (
    <div className="space-y-6">
      {canUpdate && (
        <button
          onClick={() => onAction('/api/stage/4/update', 'DDCR update')}
          disabled={loading}
          className="px-4 py-2 bg-[#003781] hover:bg-[#0066B2] text-white text-sm rounded-md font-medium disabled:opacity-50"
        >
          {loading ? 'Updating...' : 'Update DDCR Work Products'}
        </button>
      )}

      <div className="bg-white border border-[#D0D7E3] rounded-lg p-6" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
        <h2 className="text-[#1A1A2E] font-semibold mb-4">DDCR Work Products — IT App X</h2>
        <div className="space-y-3">
          {data.workProducts.map(wp => (
            <div key={wp.name} className="flex items-center justify-between p-4 bg-[#F4F6F9] rounded-md border border-[#D0D7E3]">
              <span className="text-[#1A1A2E] text-sm">{wp.name}</span>
              <span className={clsx('text-sm font-semibold',
                wp.status === 'Fulfilled' ? 'text-[#0A7C59]' :
                wp.status === 'Not Fulfilled' ? 'text-[#E4002B]' :
                'text-[#4A5568]'
              )}>
                {wp.status}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[#4A5568]/60 text-xs mt-4">Status derived from policy evaluations POL-BACKUP-001 + POL-BACKUP-002. Not directly editable.</p>
      </div>

      <StageTabView
        stageNumber={4}
        originalSources={[
          { label: 'Policy Evaluations', path: 'data/generated/azure/it_app_x_resources_after.json', format: 'json', description: 'Azure Policy evaluation results' },
        ]}
        parsedDataPaths={['data/normalized/policy_evaluations.json']}
        generatedFiles={[
          { label: 'DDCR Work Products', path: 'data/generated/ddcr/IT_App_X_DDCR_workproducts.csv', format: 'csv', exists: stage4Done, description: 'Updated DDCR status derived from policy evidence' },
        ]}
        evidenceFilter="stage-4"
      />
    </div>
  )
}

// ── Stage 5 ──

function Stage5Content({ data, onAction, onApproval, loading }: { data: DemoData; onAction: (path: string, label: string) => void; onApproval: (title: string, desc: string, path: string) => void; loading: boolean }) {
  const canPropose = data.state === 'DDCR_UPDATED'
  const canApprove = data.state === 'DOCS_PROPOSED'
  const stage5Done = data.state === 'DOCS_APPROVED'
  const sdd = data.documents.find(d => d.type === 'SDD')
  const om = data.documents.find(d => d.type === 'OperatingManual')

  const [viewerDoc, setViewerDoc] = useState<ViewerDocument | null>(null)

  const downloadEvidence = async (docId: string, docTitle: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/evidence-pack?documentId=${encodeURIComponent(docId)}`)
      const pack: unknown = await res.json()
      const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `evidence-${docTitle.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silently ignore download errors in demo
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        {canPropose && (
          <button
            onClick={() => onAction('/api/stage/5/propose', 'Documentation proposal')}
            disabled={loading}
            className="px-4 py-2 bg-[#003781] hover:bg-[#0066B2] text-white text-sm rounded-md font-medium disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Documentation Update (AI)'}
          </button>
        )}
        {canApprove && (
          <button
            onClick={() => onApproval('Approve Documentation Updates', 'Review SDD v2.5 and Operating Manual v1.9 before approving.', '/api/stage/5/approve')}
            className="px-4 py-2 bg-[#0A7C59] hover:bg-[#0A7C59]/90 text-white text-sm rounded-md font-medium"
          >
            Review & Approve Documents
          </button>
        )}
      </div>

      {[sdd, om].filter(Boolean).map(doc => {
        if (!doc) return null
        const latest = doc.versions.find(v => v.status === 'active') ?? doc.versions[0]
        const proposed = doc.versions.find(v => v.status === 'proposed')
        const approved = doc.versions.find(v => v.status === 'approved')
        const displayVersion = approved ?? proposed

        return (
          <div
            key={doc.id}
            onClick={() => setViewerDoc(doc)}
            className="bg-white border border-[#D0D7E3] hover:border-[#003781]/40 rounded-lg p-6 cursor-pointer transition-colors group"
            style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
          >
            {/* Card header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-[#1A1A2E] font-semibold group-hover:text-[#003781] transition-colors">
                  {doc.title}
                </h2>
                <p className="text-[#4A5568] text-xs mt-0.5">Click to view diff</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                {/* Evidence icon button */}
                <button
                  title="Download Evidence Pack"
                  onClick={e => downloadEvidence(doc.id, doc.title, e)}
                  className="p-1.5 rounded-md bg-[#F4F6F9] hover:bg-[#D0D7E3] text-[#4A5568] hover:text-[#1A1A2E] transition-colors border border-[#D0D7E3]"
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Version badges row */}
            <div className="flex items-center gap-2 mb-4">
              {latest && (
                <span className="px-2 py-0.5 bg-[#F4F6F9] text-[#4A5568] text-xs rounded border border-[#D0D7E3]">
                  Current v{latest.version}
                </span>
              )}
              {displayVersion && (
                <>
                  <span className={clsx(
                    'px-2 py-0.5 text-xs rounded border',
                    approved ? 'bg-[#0A7C59]/10 text-[#0A7C59] border-[#0A7C59]/30' : 'bg-[#003781]/10 text-[#003781] border-[#003781]/30'
                  )}>
                    {approved ? 'Approved' : 'Proposed'} v{displayVersion.version}
                  </span>
                  <AiBadge />
                </>
              )}
              {!displayVersion && (
                <span className="text-[#4A5568]/60 text-xs">No proposed version yet</span>
              )}
            </div>

            {/* Side-by-side preview (compact) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[#4A5568]/70 text-xs mb-1">Current</p>
                <pre className="bg-[#F4F6F9] border border-[#D0D7E3] rounded p-2 text-xs text-[#4A5568] overflow-hidden max-h-24 whitespace-pre-wrap">
                  {latest?.content ?? ''}
                </pre>
              </div>
              <div>
                <p className="text-[#4A5568]/70 text-xs mb-1">{approved ? 'Approved' : 'Proposed'}</p>
                <pre className={clsx(
                  'bg-[#F4F6F9] border border-[#D0D7E3] rounded p-2 text-xs overflow-hidden max-h-24 whitespace-pre-wrap',
                  approved ? 'text-[#0A7C59]' : 'text-[#003781]'
                )}>
                  {displayVersion?.proposedContent ?? displayVersion?.content ?? 'Not yet generated'}
                </pre>
              </div>
            </div>
          </div>
        )
      })}

      {/* Document Viewer modal */}
      <DocumentViewer
        isOpen={!!viewerDoc}
        document={viewerDoc}
        onClose={() => setViewerDoc(null)}
        canApprove={canApprove}
        onApprove={() => {
          setViewerDoc(null)
          onApproval(
            'Approve Documentation Updates',
            'Review SDD v2.5 and Operating Manual v1.9 before approving.',
            '/api/stage/5/approve',
          )
        }}
      />

      {(() => {
        const sddVersions = sdd?.versions ?? []
        const sddCurrent = sddVersions.find(v => v.status === 'active') ?? sddVersions[0]
        const sddProposed = sddVersions.find(v => v.status === 'proposed' || v.status === 'approved')
        return (
          <StageTabView
            stageNumber={5}
            originalSources={[
              { label: 'System Design Document v2.4', path: 'data/raw/docs/System_Design_Document_v2.4.docx', format: 'docx', description: 'Current SDD before update' },
              { label: 'Operating Manual v1.8', path: 'data/raw/docs/Operating_Manual_v1.8.docx', format: 'docx', description: 'Current OM before update' },
            ]}
            parsedDataPaths={['data/normalized/sdd_v24.json', 'data/normalized/om_v18.json']}
            generatedFiles={[
              { label: 'System Design Document v2.5', path: 'data/generated/docs/System_Design_Document_v2.5.docx', format: 'docx', exists: stage5Done, description: 'Updated SDD with backup section' },
              { label: 'Operating Manual v1.9', path: 'data/generated/docs/Operating_Manual_v1.9.docx', format: 'docx', exists: stage5Done, description: 'Updated OM with backup procedure' },
            ]}
            diffView={sddCurrent && sddProposed ? <DocumentDiff currentContent={sddCurrent.content} proposedContent={sddProposed.proposedContent ?? sddProposed.content} /> : undefined}
            evidenceFilter="stage-5"
          />
        )
      })()}
    </div>
  )
}

// ── Stage 6 ──

function Stage6Content() {
  const [question, setQuestion] = useState(
    'How does IT App X fulfil the DORA Article 12 backup requirements?'
  )
  const [answer, setAnswer] = useState<string | null>(null)
  const [citations, setCitations] = useState<Array<{ label: string; path: string; format: string }>>([])
  const [loading, setLoading] = useState(false)

  const ask = async () => {
    setLoading(true)
    setAnswer(null)
    setCitations([])
    try {
      const res = await fetch('/api/audit/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await res.json()
      if (data.error) {
        setAnswer(data.error)
      } else {
        const auditAnswer = data.answer
        let displayText = ''
        if (typeof auditAnswer === 'string') {
          displayText = auditAnswer
        } else if (auditAnswer?.directResponse) {
          const parts: string[] = [auditAnswer.directResponse]
          if (Array.isArray(auditAnswer.sections)) {
            for (const s of auditAnswer.sections as Array<{ heading: string; content: string }>) {
              parts.push(`\n${s.heading}\n${s.content}`)
            }
          }
          displayText = parts.join('\n')
        } else {
          displayText = 'No answer returned'
        }
        setAnswer(displayText)
        setCitations(data.citations ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: 'var(--mr-midnight-blue)' }}>
          Ask an audit question
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && ask()}
            className="flex-1 px-3 py-2 text-sm rounded"
            style={{ border: '1px solid var(--color-border)', outline: 'none', background: 'white' }}
            placeholder="Ask about compliance, controls, evidence…"
          />
          <button
            onClick={ask}
            disabled={loading || !question.trim()}
            className="px-4 py-2 text-sm font-semibold rounded disabled:opacity-50"
            style={{ background: 'var(--mr-vibrant-blue)', color: 'white', border: 'none', cursor: loading ? 'wait' : 'pointer' }}
          >
            {loading ? 'Analysing…' : 'Ask'}
          </button>
        </div>
      </div>

      {answer && (
        <div
          className="p-4 rounded space-y-3"
          style={{ background: 'var(--mr-light-grey)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <AiBadge />
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>AI-generated response</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--mr-midnight-blue)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {answer}
          </p>
          {citations.length > 0 && (
            <div className="pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Evidence documents
              </p>
              <div className="flex flex-wrap gap-2">
                {citations.map(c => (
                  <a
                    key={c.path}
                    href={`/api/os/open?path=${encodeURIComponent(c.path)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium"
                    style={{
                      background: 'var(--mr-light-blue)',
                      color: 'var(--mr-midnight-blue)',
                      border: '1px solid var(--color-border)',
                      textDecoration: 'none',
                    }}
                  >
                    <span style={{ opacity: 0.6 }}>{c.format.toUpperCase()}</span>
                    {c.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <StageTabView
        stageNumber={6}
        originalSources={[
          { label: 'Evidence Manifest', path: 'data/generated/evidence/evidence_manifest.json', format: 'json', description: 'Complete evidence chain from all stages' },
        ]}
        parsedDataPaths={['data/evidence/transform_log.jsonl']}
        generatedFiles={[
          { label: 'RQMT Audit Response', path: 'data/generated/evidence/RQMT_Audit_Response.docx', format: 'docx', exists: false, description: 'AI-generated audit answer with full traceability' },
        ]}
        evidenceFilter="stage-6"
      />

      <div className="pt-2">
        <a
          href="/evidence-centre"
          className="inline-flex items-center gap-1 text-sm font-medium"
          style={{ color: 'var(--mr-vibrant-blue)', textDecoration: 'none' }}
        >
          View all evidence in Evidence Centre →
        </a>
      </div>
    </div>
  )
}
