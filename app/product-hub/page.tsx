'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type Stage = 'ACTION_REQUIRED' | 'DOC_GENERATED' | 'GAPS_FOUND' | 'REMEDIATION' | 'FULFILLED'

interface ProductEntry {
  product: { id: string; name: string; criticality: string; type: string; owner: string | null }
  stage: Stage
  productGaps: Array<{ id: string; severity: string; status: string; title: string }>
  remediationCases: Array<{ id: string; status: string; title: string }>
  workProducts: Array<{ id: string; title: string; status: string }>
}

interface InboxItem {
  controlChange: {
    id: string
    title: string
    description: string
    changeType: string
    publishedAt: string | null
    requirementId: string
    gapId: string
  }
  requirement: {
    id: string
    articleRef: string
    title: string
    obligationType: string
    obligationLevel: string
    sourceId: string
  } | null
  source: { id: string; shortCode: string; name: string } | null
  affectedProducts: ProductEntry[]
}

const STAGE_CONFIG: Record<Stage, { label: string; color: string; bg: string; border: string }> = {
  ACTION_REQUIRED: { label: 'Action Required', color: '#E4002B', bg: 'rgba(228,0,43,0.08)', border: 'rgba(228,0,43,0.30)' },
  DOC_GENERATED:   { label: 'Docs Generated',  color: '#B45309', bg: 'rgba(180,83,9,0.08)',  border: 'rgba(180,83,9,0.30)' },
  GAPS_FOUND:      { label: 'Gaps Found',       color: '#D97706', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.30)' },
  REMEDIATION:     { label: 'In Remediation',   color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.30)' },
  FULFILLED:       { label: 'Fulfilled',         color: '#0A7C59', bg: 'rgba(10,124,89,0.08)', border: 'rgba(10,124,89,0.30)' },
}

const CHANGE_TYPE_LABEL: Record<string, string> = {
  NEW_CONTROL: 'New Control',
  AMEND_CONTROL: 'Amend Control',
  NEW_POLICY: 'New Policy',
  AMEND_POLICY: 'Amend Policy',
  PROCESS_CHANGE: 'Process Change',
}

const CRITICALITY_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: '#E4002B', bg: 'rgba(228,0,43,0.08)', border: 'rgba(228,0,43,0.25)' },
  HIGH:     { color: '#B45309', bg: 'rgba(180,83,9,0.08)', border: 'rgba(180,83,9,0.25)' },
  MEDIUM:   { color: '#003781', bg: 'rgba(0,55,129,0.08)', border: 'rgba(0,55,129,0.25)' },
  LOW:      { color: '#4A5568', bg: 'rgba(74,85,104,0.08)', border: 'rgba(74,85,104,0.25)' },
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

type BusyKey = `maya-${string}-${string}` | `mitra-${string}-${string}`

export default function ProductHubPage() {
  const [inbox, setInbox] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<Set<BusyKey>>(new Set())
  const [results, setResults] = useState<Record<string, string>>({})

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/product-hub/inbox')
      .then(r => r.json())
      .then(data => {
        setInbox(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(e => {
        setError(String(e))
        setLoading(false)
      })
  }, [])

  useEffect(() => { load() }, [load])

  async function runMaya(productId: string, controlChangeId: string) {
    const key: BusyKey = `maya-${productId}-${controlChangeId}`
    setBusy(prev => new Set(prev).add(key))
    try {
      const res = await fetch(`/api/product-hub/products/${productId}/maya`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ controlChangeId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      const count = (data.workProducts as unknown[]).length
      setResults(prev => ({ ...prev, [key]: `MAYA complete — ${count} work product${count !== 1 ? 's' : ''} generated` }))
      load()
    } catch (e) {
      setResults(prev => ({ ...prev, [key]: `Error: ${String(e)}` }))
    } finally {
      setBusy(prev => { const s = new Set(prev); s.delete(key); return s })
    }
  }

  async function runMitra(productId: string, requirementId: string, controlChangeId: string) {
    const key: BusyKey = `mitra-${productId}-${controlChangeId}`
    setBusy(prev => new Set(prev).add(key))
    try {
      const res = await fetch(`/api/product-hub/products/${productId}/mitra`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirementId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      const count = (data.gaps as unknown[]).length
      setResults(prev => ({ ...prev, [key]: `MITRA complete — ${count} gap${count !== 1 ? 's' : ''} identified (${data.coverageStatus})` }))
      load()
    } catch (e) {
      setResults(prev => ({ ...prev, [key]: `Error: ${String(e)}` }))
    } finally {
      setBusy(prev => { const s = new Set(prev); s.delete(key); return s })
    }
  }

  const actionRequired = inbox.reduce((n, item) =>
    n + item.affectedProducts.filter(p => p.stage === 'ACTION_REQUIRED').length, 0)
  const totalProducts = inbox.reduce((n, item) => n + item.affectedProducts.length, 0)

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#003781]">Product Hub</h1>
          <p className="text-[#4A5568] text-sm mt-1">Loading action inbox…</p>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-40 bg-[#F4F6F9] rounded-xl border border-[#D0D7E3]" />
          <div className="h-40 bg-[#F4F6F9] rounded-xl border border-[#D0D7E3]" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-[#003781]">Product Hub</h1>
        <p className="text-[#E4002B] text-sm">Failed to load inbox: {error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#003781]">Product Hub</h1>
          <p className="text-[#4A5568] text-sm mt-1">
            Approved control changes → product impact → MAYA document generation → MITRA assessment → DDCR
          </p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 text-sm rounded-lg border border-[#D0D7E3] text-[#4A5568] hover:border-[#003781] hover:text-[#003781] transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-[#D0D7E3] rounded-xl p-4" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.06)' }}>
          <p className="text-xs font-medium text-[#4A5568] uppercase tracking-wide">Control Changes</p>
          <p className="text-3xl font-bold text-[#003781] mt-1">{inbox.length}</p>
          <p className="text-xs text-[#4A5568] mt-0.5">published, requiring product action</p>
        </div>
        <div className="bg-white border border-[#D0D7E3] rounded-xl p-4" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.06)' }}>
          <p className="text-xs font-medium text-[#4A5568] uppercase tracking-wide">Products in Scope</p>
          <p className="text-3xl font-bold text-[#003781] mt-1">{totalProducts}</p>
          <p className="text-xs text-[#4A5568] mt-0.5">across all active changes</p>
        </div>
        <div
          className="rounded-xl p-4 border"
          style={{
            background: actionRequired > 0 ? 'rgba(228,0,43,0.05)' : 'rgba(10,124,89,0.05)',
            borderColor: actionRequired > 0 ? 'rgba(228,0,43,0.25)' : 'rgba(10,124,89,0.25)',
            boxShadow: '0 1px 3px rgba(0,56,129,0.06)',
          }}
        >
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: actionRequired > 0 ? '#E4002B' : '#0A7C59' }}>
            Action Required
          </p>
          <p className="text-3xl font-bold mt-1" style={{ color: actionRequired > 0 ? '#E4002B' : '#0A7C59' }}>
            {actionRequired}
          </p>
          <p className="text-xs mt-0.5" style={{ color: actionRequired > 0 ? '#E4002B' : '#0A7C59' }}>
            product{actionRequired !== 1 ? 's' : ''} awaiting first action
          </p>
        </div>
      </div>

      {/* Inbox */}
      {inbox.length === 0 ? (
        <div
          className="bg-white border border-[#D0D7E3] rounded-xl px-8 py-16 text-center"
          style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.06)' }}
        >
          <p className="text-lg font-semibold text-[#003781]">No published control changes</p>
          <p className="text-sm text-[#4A5568] mt-2">
            When control changes are approved and published in the Compliance Hub, they will appear here for product-level action.
          </p>
          <Link
            href="/compliance-hub"
            className="inline-block mt-4 px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity"
            style={{ background: '#003781' }}
          >
            Go to Compliance Hub →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {inbox.map(item => {
            const { controlChange: cc, requirement: req, source, affectedProducts } = item
            const ctLabel = CHANGE_TYPE_LABEL[cc.changeType] ?? cc.changeType.replace(/_/g, ' ')

            return (
              <div
                key={cc.id}
                className="bg-white border border-[#D0D7E3] rounded-xl overflow-hidden"
                style={{ boxShadow: '0 1px 4px rgba(0,56,129,0.08)' }}
              >
                {/* Control change header */}
                <div className="px-6 py-4 border-b border-[#D0D7E3] bg-[#F4F6F9]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        {source && (
                          <span
                            className="px-2 py-0.5 text-xs font-bold rounded border"
                            style={{ color: '#003781', background: 'rgba(0,55,129,0.10)', borderColor: 'rgba(0,55,129,0.25)' }}
                          >
                            {source.shortCode}
                          </span>
                        )}
                        <span
                          className="px-2 py-0.5 text-xs font-medium rounded border text-[#4A5568] border-[#D0D7E3] bg-white"
                        >
                          {ctLabel}
                        </span>
                        {req && (
                          <span className="text-xs text-[#4A5568] font-mono">{req.articleRef}</span>
                        )}
                        <span className="text-xs text-[#4A5568]">
                          Published {fmtDate(cc.publishedAt)}
                        </span>
                        <span className="text-xs font-mono text-[#4A5568]">{cc.id}</span>
                      </div>
                      <h2 className="text-base font-bold text-[#003781]">{cc.title}</h2>
                      {req && (
                        <p className="text-sm text-[#4A5568] mt-0.5">{req.title}</p>
                      )}
                      <p className="text-sm text-[#4A5568] mt-1 line-clamp-2">{cc.description}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span
                        className="text-xs font-medium"
                        style={{ color: '#0A7C59' }}
                      >
                        {affectedProducts.length} product{affectedProducts.length !== 1 ? 's' : ''} in scope
                      </span>
                    </div>
                  </div>
                </div>

                {/* Affected products table */}
                {affectedProducts.length === 0 ? (
                  <div className="px-6 py-6 text-sm text-[#4A5568] text-center">
                    No products currently mapped to this requirement.
                  </div>
                ) : (
                  <div className="divide-y divide-[#D0D7E3]">
                    {affectedProducts.map(entry => {
                      const { product, stage } = entry
                      const sc = STAGE_CONFIG[stage]
                      const crit = CRITICALITY_CONFIG[product.criticality] ?? CRITICALITY_CONFIG.LOW
                      const mayaKey: BusyKey = `maya-${product.id}-${cc.id}`
                      const mitraKey: BusyKey = `mitra-${product.id}-${cc.id}`
                      const mayaBusy = busy.has(mayaKey)
                      const mitraBusy = busy.has(mitraKey)
                      const mayaResult = results[mayaKey]
                      const mitraResult = results[mitraKey]
                      const isFulfilled = stage === 'FULFILLED'

                      return (
                        <div key={product.id} className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            {/* Product info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link
                                  href={`/product-hub/products/${product.id}`}
                                  className="text-sm font-semibold text-[#003781] hover:underline"
                                >
                                  {product.name}
                                </Link>
                                <span
                                  className="px-1.5 py-0.5 text-xs font-medium rounded border"
                                  style={{ color: crit.color, background: crit.bg, borderColor: crit.border }}
                                >
                                  {product.criticality}
                                </span>
                                <span className="text-xs text-[#4A5568] font-mono">{product.id}</span>
                              </div>
                              {product.owner && (
                                <p className="text-xs text-[#4A5568] mt-0.5">Owner: {product.owner}</p>
                              )}

                              {/* Progress line */}
                              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                {(
                                  ['ACTION_REQUIRED', 'DOC_GENERATED', 'GAPS_FOUND', 'REMEDIATION', 'FULFILLED'] as Stage[]
                                ).map((s, idx, arr) => {
                                  const stageIdx = arr.indexOf(stage)
                                  const thisIdx = idx
                                  const done = thisIdx < stageIdx
                                  const current = thisIdx === stageIdx
                                  return (
                                    <div key={s} className="flex items-center gap-1">
                                      <span
                                        className="text-xs px-1.5 py-0.5 rounded"
                                        style={{
                                          background: current ? STAGE_CONFIG[s].bg : done ? 'rgba(10,124,89,0.08)' : 'rgba(74,85,104,0.06)',
                                          color: current ? STAGE_CONFIG[s].color : done ? '#0A7C59' : '#9AA3AF',
                                          fontWeight: current ? 600 : 400,
                                        }}
                                      >
                                        {STAGE_CONFIG[s].label}
                                      </span>
                                      {idx < arr.length - 1 && (
                                        <span style={{ color: done ? '#0A7C59' : '#D0D7E3', fontSize: 10 }}>→</span>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>

                              {/* Result messages */}
                              {(mayaResult || mitraResult) && (
                                <div className="mt-2 space-y-1">
                                  {mayaResult && (
                                    <p className={`text-xs ${mayaResult.startsWith('Error') ? 'text-[#E4002B]' : 'text-[#0A7C59]'}`}>
                                      MAYA: {mayaResult}
                                    </p>
                                  )}
                                  {mitraResult && (
                                    <p className={`text-xs ${mitraResult.startsWith('Error') ? 'text-[#E4002B]' : 'text-[#0A7C59]'}`}>
                                      MITRA: {mitraResult}
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Gap / work product summary */}
                              {(entry.productGaps.length > 0 || entry.workProducts.length > 0) && (
                                <div className="flex items-center gap-4 mt-1.5">
                                  {entry.workProducts.length > 0 && (
                                    <span className="text-xs text-[#4A5568]">
                                      {entry.workProducts.length} doc{entry.workProducts.length !== 1 ? 's' : ''} generated
                                    </span>
                                  )}
                                  {entry.productGaps.length > 0 && (
                                    <span className="text-xs text-[#B45309]">
                                      {entry.productGaps.filter(g => g.status !== 'RESOLVED').length} open gap{entry.productGaps.filter(g => g.status !== 'RESOLVED').length !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Stage badge */}
                            <span
                              className="flex-shrink-0 px-3 py-1 text-xs font-semibold rounded-full border"
                              style={{ color: sc.color, background: sc.bg, borderColor: sc.border }}
                            >
                              {sc.label}
                            </span>

                            {/* Action buttons */}
                            <div className="flex-shrink-0 flex items-center gap-2">
                              <button
                                onClick={() => runMaya(product.id, cc.id)}
                                disabled={mayaBusy || mitraBusy || isFulfilled}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{
                                  background: isFulfilled ? 'rgba(74,85,104,0.06)' : 'rgba(0,55,129,0.08)',
                                  color: isFulfilled ? '#9AA3AF' : '#003781',
                                  borderColor: isFulfilled ? '#D0D7E3' : 'rgba(0,55,129,0.25)',
                                }}
                                title="MAYA — Generate document updates for this product"
                              >
                                {mayaBusy ? 'Running…' : entry.workProducts.length > 0 ? 'Re-MAYA' : 'MAYA'}
                              </button>
                              <button
                                onClick={() => runMitra(product.id, cc.requirementId, cc.id)}
                                disabled={mayaBusy || mitraBusy || isFulfilled}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{
                                  background: isFulfilled ? 'rgba(74,85,104,0.06)' : 'rgba(10,124,89,0.08)',
                                  color: isFulfilled ? '#9AA3AF' : '#0A7C59',
                                  borderColor: isFulfilled ? '#D0D7E3' : 'rgba(10,124,89,0.30)',
                                }}
                                title="MITRA — Assess compliance gaps for this product"
                              >
                                {mitraBusy ? 'Assessing…' : entry.productGaps.length > 0 ? 'Re-MITRA' : 'MITRA'}
                              </button>
                              <Link
                                href={`/product-hub/products/${product.id}`}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#D0D7E3] text-[#4A5568] hover:border-[#003781] hover:text-[#003781] transition-colors"
                              >
                                Detail →
                              </Link>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
