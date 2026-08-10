'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  MinusCircle,
  Clock,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Play,
  Shield,
  FileText,
  History,
} from 'lucide-react'
import { clsx } from 'clsx'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type DDCRStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'NOT_APPLICABLE' | 'EXCEPTION_APPROVED' | 'PENDING'
type VerifStatus = 'PASSED' | 'FAILED' | 'INCONCLUSIVE' | 'NOT_RUN'

interface CriterionResult {
  criterion: {
    id: string
    title: string
    description: string | null
    verifierType: string
    isMandatory: boolean
    policyCode: string | null
  }
  latestResult: {
    id: string
    status: VerifStatus
    observedValue: unknown
    evidenceReference: string | null
    verifiedAt: string
    notes: string | null
  } | null
}

interface HistoryEntry {
  id: string
  status: string
  previousStatus: string | null
  reason: string | null
  transitionedAt: string
  transitionedBy: string | null
  controlChangeId: string | null
  evidencePackageId: string | null
}

interface RequirementDetail {
  record: {
    id: string
    status: DDCRStatus
    effectiveAt: string
    evidencePackageId: string | null
    reportedAt: string
    reportedBy: string | null
    notes: string | null
  }
  requirement: {
    id: string
    sourceId: string
    articleRef: string
    title: string
    description: string
    obligationType: string
    obligationLevel: string
  } | null
  source: { id: string; shortCode: string; name: string } | null
  evidencePackage: {
    id: string
    status: string
    assembledAt: string | null
    approvedAt: string | null
    approvedBy: string | null
    verificationResultIds: string[]
  } | null
  criteria: CriterionResult[]
  history: HistoryEntry[]
}

interface RegulationDetail {
  sourceId: string | null
  shortCode: string
  regulationName: string
  status: DDCRStatus
  effectiveAt: string
  notes: string | null
  requirementCount: number
  nonCompliantCount: number
  compliantCount: number
}

interface ProductDetail {
  product: {
    id: string
    name: string
    type: string
    criticality: string
    hostingModel: string | null
    applicationId: string | null
    owner: string | null
    description: string | null
    status: string
  }
  overallStatus: {
    status: DDCRStatus
    effectiveAt: string
    reportedAt: string
    notes: string | null
  } | null
  byRegulation: RegulationDetail[]
  byRequirement: RequirementDetail[]
}

interface RunVerifResult {
  criterionId: string
  status: 'PASSED' | 'FAILED' | 'INCONCLUSIVE'
  notes?: string
  observedValue?: unknown
  evidenceReference?: string
  verifiedAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<DDCRStatus, { label: string; color: string; bg: string }> = {
  COMPLIANT: { label: 'COMPLIANT', color: '#0A7C59', bg: '#F0FAF6' },
  NON_COMPLIANT: { label: 'NON-COMPLIANT', color: '#E4002B', bg: '#FFF0F3' },
  NOT_APPLICABLE: { label: 'N/A', color: '#4A5568', bg: '#F7F8FA' },
  EXCEPTION_APPROVED: { label: 'EXCEPTION', color: '#B45309', bg: '#FFFBEB' },
  PENDING: { label: 'PENDING', color: '#B45309', bg: '#FFFBEB' },
}

const VERIF_CFG: Record<VerifStatus, { label: string; color: string; icon: React.FC<{ className?: string }> }> = {
  PASSED: { label: 'PASSED', color: '#0A7C59', icon: ({ className }) => <CheckCircle2 className={className} /> },
  FAILED: { label: 'FAILED', color: '#E4002B', icon: ({ className }) => <AlertCircle className={className} /> },
  INCONCLUSIVE: { label: 'INCONCLUSIVE', color: '#B45309', icon: ({ className }) => <Clock className={className} /> },
  NOT_RUN: { label: 'NOT RUN', color: '#4A5568', icon: ({ className }) => <MinusCircle className={className} /> },
}

function StatusBadge({ status, size = 'sm' }: { status: DDCRStatus; size?: 'sm' | 'lg' | 'xl' }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.PENDING
  const StatusIcon = status === 'COMPLIANT' ? CheckCircle2
    : status === 'NON_COMPLIANT' ? AlertCircle
    : status === 'NOT_APPLICABLE' ? MinusCircle
    : Clock
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-semibold rounded-md',
        size === 'xl' ? 'px-4 py-2 text-base'
          : size === 'lg' ? 'px-3 py-1.5 text-sm'
          : 'px-2 py-0.5 text-xs'
      )}
      style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }}
    >
      <StatusIcon className={size === 'xl' ? 'w-5 h-5' : size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} />
      {cfg.label}
    </span>
  )
}

function VerifBadge({ status }: { status: VerifStatus }) {
  const cfg = VERIF_CFG[status] ?? VERIF_CFG.NOT_RUN
  const Icon = cfg.icon
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: cfg.color }}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidence Package Card
// ─────────────────────────────────────────────────────────────────────────────

function EvidencePackageCard({ ep }: { ep: RequirementDetail['evidencePackage'] }) {
  if (!ep) return null
  const isComplete = ep.status === 'COMPLETE'
  return (
    <div
      className="rounded-lg p-3 flex items-start gap-3"
      style={{
        backgroundColor: isComplete ? '#F0FAF6' : '#FFFBEB',
        border: `1px solid ${isComplete ? '#0A7C5940' : '#B4530940'}`,
      }}
    >
      <Shield
        className="w-4 h-4 flex-shrink-0 mt-0.5"
        style={{ color: isComplete ? '#0A7C59' : '#B45309' }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-xs font-mono" style={{ color: isComplete ? '#0A7C59' : '#B45309' }}>
            {ep.id}
          </span>
          <span
            className="text-xs font-semibold px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: isComplete ? '#0A7C5920' : '#B4530920',
              color: isComplete ? '#0A7C59' : '#B45309',
            }}
          >
            {ep.status}
          </span>
        </div>
        <div className="flex gap-4 mt-1 text-xs text-[#4A5568] flex-wrap">
          {ep.assembledAt && <span>Assembled: {formatDate(ep.assembledAt)}</span>}
          {ep.approvedAt && <span>Approved: {formatDate(ep.approvedAt)}</span>}
          {ep.approvedBy && <span>By: {ep.approvedBy}</span>}
          {ep.verificationResultIds.length > 0 && (
            <span>{ep.verificationResultIds.length} verification result{ep.verificationResultIds.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Verification Checklist
// ─────────────────────────────────────────────────────────────────────────────

function VerificationChecklist({
  criteria,
  liveResults,
}: {
  criteria: CriterionResult[]
  liveResults: Map<string, RunVerifResult>
}) {
  if (criteria.length === 0) {
    return (
      <p className="text-xs text-[#4A5568] italic">No verification criteria defined for this requirement.</p>
    )
  }

  return (
    <div className="space-y-2">
      {criteria.map(({ criterion, latestResult }) => {
        const live = liveResults.get(criterion.id)
        const result = live ? { status: live.status, notes: live.notes ?? null, verifiedAt: live.verifiedAt } : latestResult

        return (
          <div
            key={criterion.id}
            className="flex items-start gap-3 p-3 rounded-lg"
            style={{
              backgroundColor: result?.status === 'PASSED' ? '#F0FAF6'
                : result?.status === 'FAILED' ? '#FFF0F3'
                : '#F4F6F9',
              border: `1px solid ${result?.status === 'PASSED' ? '#0A7C5930'
                : result?.status === 'FAILED' ? '#E4002B30'
                : '#D0D7E3'}`,
            }}
          >
            <div className="flex-shrink-0 mt-0.5">
              {result?.status === 'PASSED' && <CheckCircle2 className="w-4 h-4" style={{ color: '#0A7C59' }} />}
              {result?.status === 'FAILED' && <AlertCircle className="w-4 h-4" style={{ color: '#E4002B' }} />}
              {result?.status === 'INCONCLUSIVE' && <Clock className="w-4 h-4" style={{ color: '#B45309' }} />}
              {!result && <MinusCircle className="w-4 h-4 text-[#D0D7E3]" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <p className="text-sm font-medium" style={{ color: '#003781' }}>
                  {criterion.title}
                  {criterion.isMandatory && (
                    <span className="ml-1.5 text-xs font-normal text-[#4A5568]">(mandatory)</span>
                  )}
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {result
                    ? <VerifBadge status={result.status as VerifStatus} />
                    : <span className="text-xs text-[#A0ADB9]">not run</span>
                  }
                  {live && (
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{ backgroundColor: '#EBF5FF', color: '#003781' }}>
                      fresh
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 mt-1 text-xs text-[#4A5568]">
                <span>
                  <span className="text-[#A0ADB9]">Type: </span>
                  {criterion.verifierType.replace('_', ' ')}
                </span>
                {criterion.policyCode && (
                  <span>
                    <span className="text-[#A0ADB9]">Policy: </span>
                    <span className="font-mono">{criterion.policyCode}</span>
                  </span>
                )}
                {result?.verifiedAt && (
                  <span>
                    <span className="text-[#A0ADB9]">Verified: </span>
                    {formatDate(result.verifiedAt)}
                  </span>
                )}
              </div>
              {result?.notes && (
                <p className="text-xs mt-1.5" style={{ color: result.status === 'FAILED' ? '#E4002B' : '#4A5568' }}>
                  {result.notes}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Status History Timeline
// ─────────────────────────────────────────────────────────────────────────────

function StatusTimeline({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) {
    return <p className="text-xs text-[#4A5568] italic">No status history recorded.</p>
  }

  return (
    <div className="space-y-3">
      {history.map((entry, idx) => {
        const cfg = STATUS_CFG[entry.status as DDCRStatus] ?? { color: '#4A5568', bg: '#F4F6F9' }
        return (
          <div key={entry.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
                style={{ backgroundColor: cfg.color }}
              />
              {idx < history.length - 1 && (
                <div className="w-px flex-1 mt-1" style={{ backgroundColor: '#D0D7E3', minHeight: '16px' }} />
              )}
            </div>
            <div className="flex-1 pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold" style={{ color: cfg.color }}>
                  {entry.status}
                </span>
                {entry.previousStatus && (
                  <span className="text-xs text-[#A0ADB9]">← from {entry.previousStatus}</span>
                )}
                <span className="text-xs text-[#A0ADB9] ml-auto">{formatDateTime(entry.transitionedAt)}</span>
              </div>
              {entry.reason && (
                <p className="text-xs text-[#4A5568] mt-0.5 leading-relaxed">{entry.reason}</p>
              )}
              {entry.transitionedBy && (
                <p className="text-xs text-[#A0ADB9] mt-0.5">By: {entry.transitionedBy}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Requirement Card
// ─────────────────────────────────────────────────────────────────────────────

function RequirementCard({
  detail,
  productId,
  onVerificationComplete,
}: {
  detail: RequirementDetail
  productId: string
  onVerificationComplete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'checks' | 'evidence' | 'history'>('checks')
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [liveResults, setLiveResults] = useState<Map<string, RunVerifResult>>(new Map())

  const { record, requirement, source, evidencePackage, criteria, history } = detail
  const reqId = requirement?.id ?? ''
  const isCompliant = record.status === 'COMPLIANT'
  const isNotApplicable = record.status === 'NOT_APPLICABLE'

  const handleRunVerification = async () => {
    if (!reqId) return
    setRunning(true)
    setRunError(null)
    try {
      const res = await fetch('/api/verification/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, requirementId: reqId }),
      })
      const data = await res.json() as { results?: RunVerifResult[]; error?: string }
      if (data.error) {
        setRunError(data.error)
      } else if (data.results) {
        const newMap = new Map<string, RunVerifResult>()
        for (const r of data.results) newMap.set(r.criterionId, r)
        setLiveResults(newMap)
        setExpanded(true)
        setActiveTab('checks')
        onVerificationComplete()
      }
    } catch (err) {
      setRunError(String(err))
    } finally {
      setRunning(false)
    }
  }

  const allCriteriaPassed = criteria.length > 0 && criteria.every(c => {
    const live = liveResults.get(c.criterion.id)
    const status = live?.status ?? c.latestResult?.status
    return status === 'PASSED'
  })

  const blockerCount = criteria.filter(c => {
    const live = liveResults.get(c.criterion.id)
    const status = live?.status ?? c.latestResult?.status
    return c.criterion.isMandatory && status !== 'PASSED'
  }).length

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        borderColor: isCompliant ? '#0A7C5940' : isNotApplicable ? '#D0D7E3' : '#E4002B30',
        boxShadow: '0 1px 3px rgba(0,56,129,0.08)',
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-4"
        style={{ backgroundColor: isCompliant ? '#F0FAF6' : isNotApplicable ? '#F7F8FA' : '#FFF8F8' }}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {source && (
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded"
                  style={{ backgroundColor: '#EBF5FF', color: '#003781' }}>
                  {source.shortCode}
                </span>
              )}
              {requirement?.articleRef && (
                <span className="text-xs font-mono text-[#4A5568]">{requirement.articleRef}</span>
              )}
              <span className="text-xs text-[#4A5568]">
                {requirement?.obligationType?.replace('_', ' ')}
              </span>
            </div>
            <h3 className="font-semibold text-sm leading-snug" style={{ color: '#003781' }}>
              {requirement?.title ?? reqId}
            </h3>
            {!isCompliant && !isNotApplicable && blockerCount > 0 && (
              <p className="text-xs mt-1" style={{ color: '#E4002B' }}>
                {blockerCount} mandatory check{blockerCount !== 1 ? 's' : ''} not passed
              </p>
            )}
            {isCompliant && (
              <p className="text-xs mt-1" style={{ color: '#0A7C59' }}>
                All checks passed &mdash; evidence confirmed
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={record.status} size="sm" />
            {!isNotApplicable && (
              <button
                onClick={handleRunVerification}
                disabled={running}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-60"
                style={{ backgroundColor: '#003781' }}
                title="Run automated verification checks"
              >
                {running
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Play className="w-3 h-3" />
                }
                {running ? 'Running…' : 'Run Verification'}
              </button>
            )}
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: '#4A5568' }}
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {runError && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {runError}
          </div>
        )}

        {liveResults.size > 0 && (
          <div className="mt-2 text-xs font-medium px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
            style={{ backgroundColor: allCriteriaPassed ? '#F0FAF6' : '#FFF0F3', color: allCriteriaPassed ? '#0A7C59' : '#E4002B' }}>
            {allCriteriaPassed
              ? <><CheckCircle2 className="w-3 h-3" /> All criteria passed &mdash; verification complete</>
              : <><AlertCircle className="w-3 h-3" /> {blockerCount} mandatory criterion not yet passed</>
            }
          </div>
        )}
      </div>

      {/* Expandable body */}
      {expanded && (
        <div className="bg-white border-t border-[#D0D7E3]">
          {/* Requirement description */}
          {requirement?.description && (
            <div className="px-5 py-3 border-b border-[#D0D7E3] bg-[#F9FAFB]">
              <p className="text-xs text-[#4A5568] leading-relaxed">{requirement.description}</p>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex border-b border-[#D0D7E3]">
            {[
              { id: 'checks', label: 'Verification Checks', icon: Shield },
              { id: 'evidence', label: 'Evidence Package', icon: FileText },
              { id: 'history', label: 'Status History', icon: History },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as typeof activeTab)}
                className={clsx(
                  'flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors',
                  activeTab === id
                    ? 'border-[#003781] text-[#003781]'
                    : 'border-transparent text-[#4A5568] hover:text-[#003781]'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5">
            {activeTab === 'checks' && (
              <div>
                {isNotApplicable ? (
                  <div className="flex items-center gap-2 text-sm text-[#4A5568]">
                    <MinusCircle className="w-4 h-4" />
                    This requirement is not applicable to this product. No verification is required.
                  </div>
                ) : (
                  <VerificationChecklist
                    criteria={criteria}
                    liveResults={liveResults}
                  />
                )}
                {!isNotApplicable && !isCompliant && criteria.length > 0 && (
                  <div className="mt-4 p-3 rounded-lg border border-[#E4002B30] bg-[#FFF0F3]">
                    <p className="text-xs font-semibold mb-1" style={{ color: '#E4002B' }}>
                      Blocking — what must pass before COMPLIANT can be asserted:
                    </p>
                    <ul className="space-y-1">
                      {criteria
                        .filter(c => {
                          const live = liveResults.get(c.criterion.id)
                          const status = live?.status ?? c.latestResult?.status
                          return c.criterion.isMandatory && status !== 'PASSED'
                        })
                        .map(c => (
                          <li key={c.criterion.id} className="text-xs text-[#4A5568] flex items-center gap-1.5">
                            <AlertCircle className="w-3 h-3 flex-shrink-0" style={{ color: '#E4002B' }} />
                            {c.criterion.title}
                          </li>
                        ))
                      }
                    </ul>
                  </div>
                )}
                {isCompliant && criteria.length > 0 && (
                  <div className="mt-4 p-3 rounded-lg border border-[#0A7C5940] bg-[#F0FAF6]">
                    <p className="text-xs font-semibold mb-2" style={{ color: '#0A7C59' }}>
                      Evidence chain — what confirmed compliance:
                    </p>
                    <ul className="space-y-1.5">
                      {criteria.map(c => (
                        <li key={c.criterion.id} className="text-xs text-[#4A5568] flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#0A7C59' }} />
                          <span>
                            <span className="font-medium">{c.criterion.title}</span>
                            {c.latestResult?.notes && (
                              <span className="text-[#4A5568]"> — {c.latestResult.notes}</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'evidence' && (
              <div className="space-y-3">
                {evidencePackage ? (
                  <>
                    <EvidencePackageCard ep={evidencePackage} />
                    {evidencePackage.status === 'COMPLETE' && (
                      <p className="text-xs text-[#0A7C59] flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Evidence package is COMPLETE — all required evidence has been assembled and approved.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-[#D0D7E3]" />
                    <p className="text-sm text-[#4A5568]">No evidence package assembled yet</p>
                    {!isNotApplicable && (
                      <p className="text-xs text-[#A0ADB9] mt-1">
                        Run verification checks to begin building the evidence package.
                      </p>
                    )}
                  </div>
                )}
                {record.notes && (
                  <div className="p-3 rounded-lg bg-[#F4F6F9] border border-[#D0D7E3]">
                    <p className="text-xs font-semibold text-[#4A5568] mb-1">Notes</p>
                    <p className="text-xs text-[#4A5568]">{record.notes}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[#A0ADB9]">Effective</p>
                    <p className="font-medium text-[#003781]">{formatDate(record.effectiveAt)}</p>
                  </div>
                  <div>
                    <p className="text-[#A0ADB9]">Reported</p>
                    <p className="font-medium text-[#003781]">{formatDate(record.reportedAt)}</p>
                  </div>
                  {record.reportedBy && (
                    <div>
                      <p className="text-[#A0ADB9]">Reported by</p>
                      <p className="font-medium text-[#003781]">{record.reportedBy}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <StatusTimeline history={history} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function ProductDDCRDetailPage() {
  const params = useParams()
  const productId = (params?.productId as string) ?? ''

  const [data, setData] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!productId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ddcr/products/${encodeURIComponent(productId)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as ProductDetail | { error: string }
      if ('error' in json) throw new Error(json.error)
      setData(json)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const { product, overallStatus, byRegulation, byRequirement } = data ?? {}

  // Sort requirements: non-compliant first, then compliant, then n/a
  const sortedRequirements = [...(byRequirement ?? [])].sort((a, b) => {
    const order: Record<string, number> = { NON_COMPLIANT: 0, PENDING: 1, COMPLIANT: 2, EXCEPTION_APPROVED: 3, NOT_APPLICABLE: 4 }
    return (order[a.record.status] ?? 5) - (order[b.record.status] ?? 5)
  })

  return (
    <div className="space-y-6">
      {/* ── Back link + header ─────────────────────────────────────────────── */}
      <div>
        <Link
          href="/ddcr"
          className="inline-flex items-center gap-1.5 text-sm text-[#4A5568] hover:text-[#003781] transition-colors mb-3"
          style={{ textDecoration: 'none' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to DDCR Dashboard
        </Link>

        {product && (
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#003781' }}>
                {product.name}
              </h1>
              <p className="text-sm text-[#4A5568] mt-0.5">
                {product.type.replace('_', ' ')} &middot; {product.criticality} criticality
                {product.hostingModel && ` · ${product.hostingModel}`}
                {product.owner && ` · ${product.owner}`}
              </p>
              {product.description && (
                <p className="text-sm text-[#4A5568] mt-1 max-w-2xl">{product.description}</p>
              )}
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm border border-[#D0D7E3] text-[#4A5568] hover:text-[#003781] hover:border-[#003781] transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* ── Loading / error ────────────────────────────────────────────────── */}
      {loading && !data && (
        <div className="flex items-center justify-center h-48 text-[#4A5568]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading compliance detail…
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          <span className="font-semibold">Error: </span>{error}
        </div>
      )}

      {data && overallStatus && (
        <>
          {/* ── Overall status banner ──────────────────────────────────────── */}
          <div
            className="rounded-xl p-5 border"
            style={{
              backgroundColor: STATUS_CFG[overallStatus.status].bg,
              borderColor: `${STATUS_CFG[overallStatus.status].color}40`,
              boxShadow: '0 1px 3px rgba(0,56,129,0.08)',
            }}
          >
            <div className="flex items-center gap-4 flex-wrap">
              <StatusBadge status={overallStatus.status} size="xl" />
              <div>
                <p className="font-semibold text-sm" style={{ color: '#003781' }}>
                  Overall Compliance Status
                </p>
                <p className="text-xs text-[#4A5568] mt-0.5">
                  Effective {formatDate(overallStatus.effectiveAt)} &middot; Reported {formatDate(overallStatus.reportedAt)}
                </p>
                {overallStatus.notes && (
                  <p className="text-xs text-[#4A5568] mt-1">{overallStatus.notes}</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Regulation overview cards ──────────────────────────────────── */}
          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: '#003781' }}>
              By Regulation
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {byRegulation?.map((reg) => (
                <div
                  key={reg.sourceId ?? reg.shortCode}
                  className="rounded-xl p-4 border"
                  style={{
                    backgroundColor: STATUS_CFG[reg.status]?.bg ?? '#F4F6F9',
                    borderColor: `${STATUS_CFG[reg.status]?.color ?? '#D0D7E3'}40`,
                    boxShadow: '0 1px 3px rgba(0,56,129,0.08)',
                  }}
                >
                  <p className="text-xs font-mono font-bold mb-1" style={{ color: STATUS_CFG[reg.status]?.color ?? '#4A5568' }}>
                    {reg.shortCode}
                  </p>
                  <StatusBadge status={reg.status} />
                  <p className="text-xs text-[#4A5568] mt-2 leading-snug">{reg.regulationName}</p>
                  {reg.requirementCount > 0 && (
                    <p className="text-xs mt-1 font-medium" style={{ color: STATUS_CFG[reg.status]?.color ?? '#4A5568' }}>
                      {reg.nonCompliantCount > 0
                        ? `${reg.nonCompliantCount}/${reg.requirementCount} non-compliant`
                        : `${reg.compliantCount}/${reg.requirementCount} compliant`
                      }
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── Requirement details ───────────────────────────────────────── */}
          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: '#003781' }}>
              Requirement Detail
            </h2>
            <div className="space-y-4">
              {sortedRequirements.map((detail, idx) => (
                <RequirementCard
                  key={detail.requirement?.id ?? idx}
                  detail={detail}
                  productId={productId}
                  onVerificationComplete={fetchData}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
