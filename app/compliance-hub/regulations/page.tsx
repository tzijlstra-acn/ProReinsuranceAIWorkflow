'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RegulatoryRequirement {
  id: string
  sourceId: string
  versionId: string
  articleRef: string
  title: string
  description: string
  obligationType: string
  obligationLevel: string
  applicabilityScope: string | null
  status: string
}

interface RegulatorySource {
  id: string
  shortCode: string
  name: string
  jurisdiction: string
  status: string
  effectiveDate: string | null
  description: string | null
  eurLexUrl: string | null
  requirementCount: number
  gapCount: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function obligationTypeBadge(type: string): { bg: string; text: string } {
  switch (type) {
    case 'TECHNICAL_CONTROL': return { bg: '#EBF5FF', text: '#003781' }
    case 'PROCESS': return { bg: '#FEF3C7', text: '#B45309' }
    case 'DOCUMENTATION': return { bg: '#F3E8FF', text: '#7C3AED' }
    case 'GOVERNANCE': return { bg: '#D1FAE5', text: '#0A7C59' }
    case 'REPORTING': return { bg: '#FEE2E2', text: '#E4002B' }
    default: return { bg: '#F3F4F6', text: '#6B7280' }
  }
}

function sourceStatusBadge(status: string): { bg: string; text: string } {
  switch (status) {
    case 'active': return { bg: '#D1FAE5', text: '#0A7C59' }
    case 'draft': return { bg: '#FEF3C7', text: '#B45309' }
    case 'superseded': return { bg: '#F3F4F6', text: '#6B7280' }
    default: return { bg: '#F3F4F6', text: '#6B7280' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Regulation card
// ─────────────────────────────────────────────────────────────────────────────

type AnalyzeState = {
  status: 'idle' | 'running' | 'done' | 'error'
  gapCount?: number
  coverageStatus?: string
  gaps?: string[]
  error?: string
}

function RegulationCard({
  source,
  requirements,
}: {
  source: RegulatorySource
  requirements: RegulatoryRequirement[]
}) {
  const statusBadge = sourceStatusBadge(source.status)
  const obligationTypes = [...new Set(requirements.map(r => r.obligationType))]
  const [analyzeStates, setAnalyzeStates] = useState<Record<string, AnalyzeState>>({})
  const [expandedGaps, setExpandedGaps] = useState<Record<string, boolean>>({})

  async function handleAnalyze(reqId: string) {
    setAnalyzeStates(prev => ({ ...prev, [reqId]: { status: 'running' } }))
    try {
      const res = await fetch(`/api/compliance-hub/requirements/${reqId}/analyze`, { method: 'POST' })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Analysis failed')
      setAnalyzeStates(prev => ({
        ...prev,
        [reqId]: {
          status: 'done',
          gapCount: data.gaps?.length ?? 0,
          coverageStatus: data.coverageStatus,
          gaps: (data.gaps ?? []).map((g: { title?: string } | string) =>
            typeof g === 'string' ? g : (g.title ?? JSON.stringify(g))
          ),
        },
      }))
    } catch (err) {
      setAnalyzeStates(prev => ({ ...prev, [reqId]: { status: 'error', error: String(err) } }))
    }
  }

  return (
    <div
      className="bg-white rounded-xl overflow-hidden"
      style={{ border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
    >
      {/* Card header */}
      <div className="px-5 py-4" style={{ borderBottom: '1px solid #D0D7E3', background: '#F4F6F9' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className="font-mono text-sm font-bold px-2 py-0.5 rounded"
                style={{ background: '#EBF5FF', color: '#003781' }}
              >
                {source.shortCode}
              </span>
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ background: statusBadge.bg, color: statusBadge.text }}
              >
                {source.status.charAt(0).toUpperCase() + source.status.slice(1)}
              </span>
            </div>
            <h2 className="text-base font-semibold" style={{ color: '#003781' }}>{source.name}</h2>
          </div>
          <div className="text-right flex-shrink-0 text-sm" style={{ color: '#4A5568' }}>
            <p className="text-xs font-medium" style={{ color: '#4A5568' }}>Jurisdiction</p>
            <p className="font-semibold text-sm" style={{ color: '#003781' }}>{source.jurisdiction}</p>
          </div>
        </div>

        <div className="flex items-center gap-6 mt-3 text-xs" style={{ color: '#4A5568' }}>
          <span>
            <span className="font-medium">Effective: </span>
            {formatDate(source.effectiveDate)}
          </span>
          <span>
            <span className="font-medium">Requirements: </span>
            {source.requirementCount}
          </span>
          {source.gapCount > 0 && (
            <span style={{ color: '#E4002B' }}>
              <span className="font-medium">Open gaps: </span>
              {source.gapCount}
            </span>
          )}
        </div>

        {/* Obligation types present */}
        {obligationTypes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {obligationTypes.map(ot => {
              const c = obligationTypeBadge(ot)
              return (
                <span
                  key={ot}
                  className="text-xs px-2 py-0.5 rounded font-medium"
                  style={{ background: c.bg, color: c.text }}
                >
                  {ot.replace(/_/g, ' ')}
                </span>
              )
            })}
          </div>
        )}

        {source.description && (
          <p className="text-xs mt-3 leading-relaxed" style={{ color: '#4A5568' }}>{source.description}</p>
        )}

        {source.eurLexUrl && (
          <a
            href={source.eurLexUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs mt-2 hover:underline"
            style={{ color: '#003781' }}
          >
            EUR-Lex source
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>

      {/* Requirements list */}
      {requirements.length > 0 ? (
        <div>
          {requirements.map((req, i) => {
            const typeBadge = obligationTypeBadge(req.obligationType)
            return (
              <div
                key={req.id}
                className="px-5 py-3"
                style={{ borderTop: i > 0 ? '1px solid #D0D7E3' : undefined }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex-shrink-0 font-mono text-xs font-semibold px-1.5 py-0.5 rounded mt-0.5"
                    style={{ background: '#F4F6F9', color: '#4A5568' }}
                  >
                    {req.articleRef}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium" style={{ color: '#003781' }}>{req.title}</p>
                      <span
                        className="flex-shrink-0 text-xs px-2 py-0.5 rounded font-medium"
                        style={{ background: typeBadge.bg, color: typeBadge.text }}
                      >
                        {req.obligationType.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: '#4A5568' }}>
                      {req.description}
                    </p>
                    <div className="flex items-center gap-4 mt-1.5 text-xs" style={{ color: '#4A5568' }}>
                      <span>
                        <span className="font-medium">Level: </span>
                        {req.obligationLevel}
                      </span>
                      <span className="font-mono" style={{ color: '#4A5568' }}>{req.id}</span>
                    </div>

                    {/* AI Analyze button + result */}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {(() => {
                        const aState = analyzeStates[req.id] ?? { status: 'idle' }
                        const isRunning = aState.status === 'running'
                        return (
                          <>
                            <button
                              disabled={isRunning}
                              onClick={() => handleAnalyze(req.id)}
                              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded transition-opacity"
                              style={{
                                background: '#7C3AED',
                                color: 'white',
                                border: 'none',
                                opacity: isRunning ? 0.7 : 1,
                                cursor: isRunning ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {isRunning ? (
                                <>
                                  <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                  </svg>
                                  Analyzing…
                                </>
                              ) : (
                                <>
                                  <span>✦</span>
                                  AI: Analyze
                                </>
                              )}
                            </button>

                            {aState.status === 'done' && (
                              <span className="text-xs" style={{ color: '#0A7C59' }}>
                                Found {aState.gapCount} gap{aState.gapCount !== 1 ? 's' : ''} · Coverage: {aState.coverageStatus}
                                {(aState.gapCount ?? 0) > 0 && (
                                  <>
                                    {' '}
                                    <button
                                      onClick={() => setExpandedGaps(prev => ({ ...prev, [req.id]: !prev[req.id] }))}
                                      className="underline"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0A7C59', fontSize: 'inherit' }}
                                    >
                                      {expandedGaps[req.id] ? 'hide' : 'show'}
                                    </button>
                                  </>
                                )}
                                {' '}
                                <Link href="/compliance-hub/gaps" className="underline font-medium" style={{ color: '#003781' }}>
                                  View Gaps →
                                </Link>
                              </span>
                            )}

                            {aState.status === 'error' && (
                              <span className="text-xs" style={{ color: '#E4002B' }}>{aState.error}</span>
                            )}
                          </>
                        )
                      })()}
                    </div>

                    {/* Expanded gap titles */}
                    {expandedGaps[req.id] && analyzeStates[req.id]?.gaps && analyzeStates[req.id].gaps!.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5 pl-2" style={{ borderLeft: '2px solid #7C3AED' }}>
                        {analyzeStates[req.id].gaps!.map((title, idx) => (
                          <li key={idx} className="text-xs" style={{ color: '#4A5568' }}>• {title}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="px-5 py-6 text-center text-sm" style={{ color: '#4A5568' }}>
          No requirements extracted yet.
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function RegulationsPage() {
  const [sources, setSources] = useState<RegulatorySource[]>([])
  const [requirements, setRequirements] = useState<RegulatoryRequirement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [srcRes, reqRes] = await Promise.all([
          fetch('/api/compliance-hub/regulations'),
          fetch('/api/compliance-hub/requirements'),
        ])
        const srcData = await srcRes.json() as RegulatorySource[] | { error: string }
        const reqData = await reqRes.json() as RegulatoryRequirement[] | { error: string }

        if ('error' in srcData) throw new Error(String(srcData.error))
        if ('error' in reqData) throw new Error(String(reqData.error))

        setSources(srcData)
        setRequirements(reqData)
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/compliance-hub" className="text-xs hover:underline" style={{ color: '#4A5568' }}>
            Compliance Hub
          </Link>
          <span style={{ color: '#D0D7E3' }}>/</span>
          <span className="text-xs" style={{ color: '#003781' }}>Regulations</span>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: '#003781' }}>Regulatory Catalogue</h1>
        <p className="text-sm mt-1" style={{ color: '#4A5568' }}>
          All monitored EU regulations with extracted requirements
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-12 justify-center" style={{ color: '#4A5568' }}>
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading regulations…
        </div>
      )}

      {error && (
        <div className="rounded-lg p-4 text-sm" style={{ background: '#FEE2E2', color: '#E4002B', border: '1px solid #FECACA' }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          {sources.length === 0 ? (
            <p className="text-center py-12 text-sm" style={{ color: '#4A5568' }}>No regulations found.</p>
          ) : (
            sources.map(source => (
              <RegulationCard
                key={source.id}
                source={source}
                requirements={requirements.filter(r => r.sourceId === source.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
