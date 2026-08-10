'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { RegulatoryDeltaAnalysis } from '@/lib/ai/provider'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PendingVersion {
  id: string
  sourceId: string
  shortCode: string
  sourceName: string
  version: string
  publishedAt: string
  changeType: string
  changeSummary: string
}

interface AnalyzeResult {
  analysis: RegulatoryDeltaAnalysis
  gapsCreated: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function changeTypeBadge(changeType: string): { bg: string; text: string; label: string } {
  switch (changeType) {
    case 'amendment': return { bg: '#FFFBEB', text: '#B45309', label: 'Amendment' }
    case 'revision': return { bg: '#FEF3C7', text: '#92400E', label: 'Revision' }
    case 'corrigendum': return { bg: '#EFF6FF', text: '#1D4ED8', label: 'Corrigendum' }
    default: return { bg: '#F3F4F6', text: '#6B7280', label: changeType }
  }
}

function severityBadge(severity: string): { bg: string; text: string } {
  switch (severity) {
    case 'CRITICAL': return { bg: '#7F1D1D', text: '#ffffff' }
    case 'HIGH': return { bg: '#FEE2E2', text: '#E4002B' }
    case 'MEDIUM': return { bg: '#FEF3C7', text: '#B45309' }
    case 'LOW': return { bg: '#F3F4F6', text: '#6B7280' }
    default: return { bg: '#F3F4F6', text: '#6B7280' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function RegulatoryUpdateDetailPage({
  params,
}: {
  params: Promise<{ versionId: string }>
}) {
  const { versionId } = use(params)
  const router = useRouter()

  const [versionData, setVersionData] = useState<PendingVersion | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null)
  const [acknowledging, setAcknowledging] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/compliance-hub/regulatory-updates')
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        const found = (data.pending as PendingVersion[]).find(v => v.id === versionId)
        if (!found) {
          setLoadError('This regulatory update could not be found or has already been acknowledged.')
        } else {
          setVersionData(found)
        }
      } catch (err) {
        setLoadError(String(err))
      }
    }
    load()
  }, [versionId])

  async function handleAnalyze() {
    setAnalyzing(true)
    setAnalyzeError(null)
    setAnalyzeResult(null)
    try {
      const res = await fetch(
        `/api/compliance-hub/regulatory-updates/${versionId}/analyze`,
        { method: 'POST' }
      )
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
      setAnalyzeResult({ analysis: data.analysis, gapsCreated: data.gapsCreated })
    } catch (err) {
      setAnalyzeError(String(err))
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleAcknowledge() {
    setAcknowledging(true)
    try {
      await fetch(
        `/api/compliance-hub/regulatory-updates/${versionId}/acknowledge`,
        { method: 'POST' }
      )
    } finally {
      setAcknowledging(false)
      router.push('/compliance-hub')
    }
  }

  const badge = versionData ? changeTypeBadge(versionData.changeType) : null

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/compliance-hub"
        className="inline-flex items-center gap-1.5 text-xs font-medium"
        style={{ color: '#4A5568' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back to Compliance Hub
      </Link>

      {/* Load error */}
      {loadError && (
        <div className="rounded-lg p-4 text-sm" style={{ background: '#FEE2E2', color: '#E4002B', border: '1px solid #FECACA' }}>
          {loadError}
        </div>
      )}

      {/* Main content */}
      {versionData && (
        <>
          {/* Header */}
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded" style={{ background: '#EBF5FF', color: '#003781' }}>
                {versionData.shortCode}
              </span>
              {badge && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.text}30` }}>
                  {badge.label}
                </span>
              )}
              <span className="text-xs" style={{ color: '#4A5568' }}>Published {formatDate(versionData.publishedAt)}</span>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: '#003781' }}>
              {versionData.sourceName}
            </h1>
            <p className="text-sm mt-1" style={{ color: '#4A5568' }}>{versionData.version}</p>
          </div>

          {/* Change summary */}
          <div
            className="rounded-lg p-5"
            style={{ background: '#FFFBEB', border: '2px solid #F59E0B' }}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5" style={{ color: '#F59E0B' }}>⚠</span>
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#B45309' }}>Change Summary</p>
                <p className="text-sm leading-relaxed" style={{ color: '#92400E' }}>
                  {versionData.changeSummary}
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          {!analyzeResult && (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                disabled={analyzing}
                onClick={handleAnalyze}
                className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded transition-opacity"
                style={{
                  background: '#7C3AED',
                  color: 'white',
                  border: 'none',
                  opacity: analyzing ? 0.6 : 1,
                  cursor: analyzing ? 'not-allowed' : 'pointer',
                }}
              >
                {analyzing ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Analyzing impact…
                  </>
                ) : (
                  <>✦ AI: Analyze Impact</>
                )}
              </button>

              <button
                disabled={acknowledging || analyzing}
                onClick={handleAcknowledge}
                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded transition-opacity"
                style={{
                  background: 'white',
                  color: '#4A5568',
                  border: '1px solid #D0D7E3',
                  opacity: acknowledging || analyzing ? 0.6 : 1,
                  cursor: acknowledging || analyzing ? 'not-allowed' : 'pointer',
                }}
              >
                {acknowledging ? 'Acknowledging…' : 'Acknowledge (no analysis)'}
              </button>
            </div>
          )}

          {/* Analyze error */}
          {analyzeError && (
            <div className="rounded-lg p-4 text-sm" style={{ background: '#FEE2E2', color: '#E4002B', border: '1px solid #FECACA' }}>
              Analysis failed: {analyzeError}
            </div>
          )}

          {/* Analyze results */}
          {analyzeResult && (
            <div className="space-y-5">
              {/* Summary card */}
              <div
                className="rounded-lg p-5"
                style={{ background: '#F5F3FF', border: '1px solid #DDD6FE' }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-base mt-0.5" style={{ color: '#7C3AED' }}>✦</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold mb-1" style={{ color: '#5B21B6' }}>AI Analysis Complete</p>
                    <p className="text-sm leading-relaxed" style={{ color: '#6D28D9' }}>
                      {analyzeResult.analysis.summary}
                    </p>
                    <div className="flex items-center gap-4 mt-3 flex-wrap">
                      <span className="text-xs font-medium px-2.5 py-1 rounded" style={{ background: '#EDE9FE', color: '#5B21B6' }}>
                        {analyzeResult.gapsCreated} gap{analyzeResult.gapsCreated !== 1 ? 's' : ''} created
                      </span>
                      <span className="text-xs font-medium px-2.5 py-1 rounded" style={{ background: '#EDE9FE', color: '#5B21B6' }}>
                        {analyzeResult.analysis.impactedRequirementIds.length} requirement{analyzeResult.analysis.impactedRequirementIds.length !== 1 ? 's' : ''} impacted
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Impacted requirements */}
              {analyzeResult.analysis.impactedRequirementIds.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold mb-2" style={{ color: '#003781' }}>Impacted Requirements</h2>
                  <div className="flex flex-wrap gap-2">
                    {analyzeResult.analysis.impactedRequirementIds.map(reqId => (
                      <span
                        key={reqId}
                        className="font-mono text-xs px-2.5 py-1 rounded"
                        style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}
                      >
                        {reqId}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* New gaps */}
              {analyzeResult.analysis.newGaps.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold mb-3" style={{ color: '#003781' }}>New Compliance Gaps Identified</h2>
                  <div className="space-y-3">
                    {analyzeResult.analysis.newGaps.map((gap, i) => {
                      const sev = severityBadge(gap.severity)
                      return (
                        <div
                          key={i}
                          className="bg-white rounded-lg p-4"
                          style={{ border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.06)' }}
                        >
                          <div className="flex items-start gap-2 flex-wrap mb-2">
                            <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: sev.bg, color: sev.text }}>
                              {gap.severity}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: '#F4F6F9', color: '#4A5568' }}>
                              {gap.gap_type.replace(/_/g, ' ')}
                            </span>
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: '#EBF5FF', color: '#003781' }}>
                              {gap.requirementId}
                            </span>
                          </div>
                          <p className="font-semibold text-sm mb-1" style={{ color: '#003781' }}>{gap.title}</p>
                          <p className="text-xs leading-relaxed mb-2" style={{ color: '#4A5568' }}>{gap.description}</p>
                          <p className="text-xs leading-relaxed" style={{ color: '#6B7280', fontStyle: 'italic' }}>{gap.aiAnalysis}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Link to gaps page */}
              <div className="pt-2">
                <Link
                  href="/compliance-hub"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded"
                  style={{ background: '#003781', color: 'white' }}
                >
                  View all compliance gaps →
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
