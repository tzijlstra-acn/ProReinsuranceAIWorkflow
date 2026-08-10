'use client'

import { use, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Product {
  id: string; name: string; type: string; criticality: string
  hostingModel: string | null; legalEntity: string | null
  owner: string | null; description: string | null; status: string
  applicationId: string | null
}

interface ComplianceItem {
  applicability: { id: string; applicable: boolean; applicabilityReason: string | null }
  requirement: { id: string; articleRef: string; title: string; obligationType: string; obligationLevel: string } | null
  source: { id: string; shortCode: string; name: string } | null
  applicable: boolean
  currentStatus: string
  openGaps: Array<{ id: string; title: string; description: string; gapType: string; severity: string; status: string; detectedAt: string }>
  workProducts: Array<{ id: string; title: string; status: string; content: string | null; documentId: string | null }>
}

interface PublishedChange {
  controlChange: { id: string; title: string; description: string; changeType: string; publishedAt: string | null; requirementId: string }
  requirement: { id: string; articleRef: string; title: string; obligationType: string } | null
  source: { id: string; shortCode: string } | null
  affectedProducts: Array<{ product: { id: string }; stage: string; workProducts: Array<{ id: string; title: string; status: string }> }>
}

interface WorkProductContent {
  documentTitle?: string; proposedContent?: string; changeSummary?: string; addedClauses?: string[]
  documentType?: string
}

const DOC_TYPE_ICON: Record<string, string> = {
  SYSTEM_DESIGN: '🏗️',
  OPERATING_MANUAL: '📋',
  IAC: '⚙️',
  POLICY: '📜',
  PROCEDURE: '📝',
  GUIDELINE: '📖',
  STANDARD: '📏',
  CONTROL: '🔒',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  COMPLIANT:     { color: '#0A7C59', bg: '#F0FAF6', border: 'rgba(10,124,89,0.2)', icon: '✓' },
  NON_COMPLIANT: { color: '#E4002B', bg: '#FEF2F2', border: 'rgba(228,0,43,0.2)', icon: '✗' },
  IN_REMEDIATION:{ color: '#B45309', bg: '#FFFBEB', border: 'rgba(180,83,9,0.2)',  icon: '↻' },
  NOT_ASSESSED:  { color: '#9AA3AF', bg: '#F4F6F9', border: '#D0D7E3',             icon: '?' },
  NOT_APPLICABLE:{ color: '#9AA3AF', bg: '#F4F6F9', border: '#D0D7E3',             icon: '—' },
}

const CRIT_CFG: Record<string, { color: string; bg: string }> = {
  CRITICAL: { color: '#E4002B', bg: 'rgba(228,0,43,0.08)' },
  HIGH:     { color: '#B45309', bg: 'rgba(180,83,9,0.08)' },
  MEDIUM:   { color: '#003781', bg: 'rgba(0,55,129,0.08)' },
  LOW:      { color: '#4A5568', bg: 'rgba(74,85,104,0.08)' },
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#7F1D1D', HIGH: '#E4002B', MEDIUM: '#B45309', LOW: '#6B7280',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function statusCfg(s: string) {
  return STATUS_CFG[s] ?? STATUS_CFG.NOT_ASSESSED
}

// ── Work product viewer ────────────────────────────────────────────────────────

function WorkProductCard({ wp }: { wp: ComplianceItem['workProducts'][0] }) {
  const [open, setOpen] = useState(false)
  let parsed: WorkProductContent | null = null
  try { parsed = wp.content ? JSON.parse(wp.content) as WorkProductContent : null } catch { /* skip */ }

  const rawType = (parsed?.documentType ?? '').toUpperCase()
  const icon = DOC_TYPE_ICON[rawType] ?? '📄'

  return (
    <div style={{ background: '#F0FAF6', border: '1px solid rgba(10,124,89,0.2)', borderRadius: 6, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(p => !p)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#0A7C59' }}>{wp.title}</span>
        {rawType && (
          <span style={{ fontSize: 10, color: '#6B7280', background: '#F4F6F9', border: '1px solid #E8EDF4', borderRadius: 3, padding: '1px 5px', flexShrink: 0 }}>
            {rawType.replace(/_/g, ' ')}
          </span>
        )}
        <span style={{ fontSize: 10, fontWeight: 700, color: '#0A7C59', background: '#D1FAE5', borderRadius: 3, padding: '1px 6px' }}>
          {wp.status}
        </span>
        <span style={{ fontSize: 11, color: '#9AA3AF' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && parsed?.changeSummary && (
        <div style={{ padding: '0 12px 12px', borderTop: '1px solid rgba(10,124,89,0.15)' }}>
          <p style={{ margin: '8px 0 4px', fontSize: 11, fontWeight: 700, color: '#9AA3AF', textTransform: 'uppercase' }}>Change summary</p>
          <p style={{ margin: 0, fontSize: 12, color: '#1A1A2E', lineHeight: 1.6 }}>{parsed.changeSummary}</p>
          {parsed.addedClauses && parsed.addedClauses.length > 0 && (
            <>
              <p style={{ margin: '8px 0 4px', fontSize: 11, fontWeight: 700, color: '#9AA3AF', textTransform: 'uppercase' }}>Added clauses</p>
              {parsed.addedClauses.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                  <span style={{ color: '#0A7C59', fontWeight: 700, flexShrink: 0 }}>+</span>
                  <span style={{ fontSize: 12, color: '#1A1A2E', lineHeight: 1.55 }}>{c}</span>
                </div>
              ))}
            </>
          )}
          {parsed.proposedContent && (
            <>
              <p style={{ margin: '8px 0 4px', fontSize: 11, fontWeight: 700, color: '#9AA3AF', textTransform: 'uppercase' }}>Proposed content</p>
              <pre style={{
                margin: 0, fontSize: 11, color: '#1A1A2E', lineHeight: 1.6,
                fontFamily: 'inherit', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                background: '#fff', border: '1px solid rgba(10,124,89,0.15)',
                borderRadius: 4, padding: '8px 10px', maxHeight: 300, overflowY: 'auto',
              }}>{parsed.proposedContent}</pre>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Compliance requirement row ─────────────────────────────────────────────────

interface ReqRowProps {
  item: ComplianceItem
  publishedChange: PublishedChange | null
  productId: string
  signerName: string
  onRefresh: () => void
}

function RequirementRow({ item, publishedChange, productId, signerName, onRefresh }: ReqRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [mayaAssessBusy, setMayaAssessBusy] = useState(false)
  const [mayaDocsBusy, setMayaDocsBusy] = useState(false)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [assessResult, setAssessResult] = useState<string | null>(null)
  const [docsResult, setDocsResult] = useState<string | null>(null)
  const [confirmResult, setConfirmResult] = useState<{ ok: boolean; message: string } | null>(null)

  const confirmCompliant = useCallback(async () => {
    if (!item.requirement || !item.source || confirmBusy || !signerName.trim()) return
    setConfirmBusy(true)
    setConfirmResult(null)
    try {
      const res = await fetch(`/api/product-hub/products/${productId}/confirm-compliant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirementId: item.requirement.id,
          sourceId: item.source.id,
          approvedBy: signerName,
        }),
      })
      const data = await res.json() as {
        ok?: boolean; gapsResolved?: number; workProductsLinked?: number
        verificationsCreated?: number; evidencePackageId?: string; error?: string
      }
      if (data.error) throw new Error(data.error)
      setConfirmResult({
        ok: true,
        message: `✓ Marked COMPLIANT · ${data.gapsResolved} gap${data.gapsResolved !== 1 ? 's' : ''} resolved · evidence package ${data.evidencePackageId} logged`,
      })
      onRefresh()
    } catch (err) {
      setConfirmResult({ ok: false, message: `Error: ${String(err)}` })
    } finally {
      setConfirmBusy(false)
    }
  }, [item, productId, signerName, confirmBusy, onRefresh])

  const cfg = statusCfg(item.currentStatus)
  const needsAction = item.currentStatus === 'NON_COMPLIANT' || item.currentStatus === 'NOT_ASSESSED' || item.openGaps.length > 0
  const isCompliant = item.currentStatus === 'COMPLIANT'
  const isApplicable = item.applicable

  const mayaAssess = useCallback(async () => {
    if (!item.requirement || mayaAssessBusy) return
    setMayaAssessBusy(true)
    setAssessResult(null)
    try {
      const res = await fetch(`/api/product-hub/products/${productId}/mitra`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirementId: item.requirement.id }),
      })
      const data = await res.json() as { gaps?: unknown[]; coverageStatus?: string; error?: string }
      if (data.error) throw new Error(data.error)
      const count = data.gaps?.length ?? 0
      setAssessResult(`${count} gap${count !== 1 ? 's' : ''} identified · ${data.coverageStatus ?? ''}`)
      onRefresh()
    } catch (err) {
      setAssessResult(`Error: ${String(err)}`)
    } finally {
      setMayaAssessBusy(false)
    }
  }, [item, productId, mayaAssessBusy, onRefresh])

  const mayaDocs = useCallback(async () => {
    if (!publishedChange || mayaDocsBusy) return
    setMayaDocsBusy(true)
    setDocsResult(null)
    try {
      const res = await fetch(`/api/product-hub/products/${productId}/maya`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ controlChangeId: publishedChange.controlChange.id }),
      })
      const data = await res.json() as { workProducts?: unknown[]; error?: string }
      if (data.error) throw new Error(data.error)
      const count = data.workProducts?.length ?? 0
      setDocsResult(`${count} document update${count !== 1 ? 's' : ''} generated`)
      onRefresh()
    } catch (err) {
      setDocsResult(`Error: ${String(err)}`)
    } finally {
      setMayaDocsBusy(false)
    }
  }, [publishedChange, productId, mayaDocsBusy, onRefresh])

  if (!isApplicable) return null

  return (
    <div style={{
      border: `1px solid ${needsAction && item.currentStatus !== 'IN_REMEDIATION' ? cfg.border : '#E8EDF4'}`,
      borderRadius: 8, background: '#fff', overflow: 'hidden',
    }}>
      {/* One-line summary */}
      <div
        onClick={() => setExpanded(p => !p)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', userSelect: 'none' }}
      >
        {/* Status icon */}
        <span style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700,
          border: `1px solid ${cfg.border}`,
        }}>{cfg.icon}</span>

        {/* Article ref */}
        <span style={{ fontSize: 12, fontWeight: 700, color: '#003781', flexShrink: 0 }}>
          {item.requirement?.articleRef}
        </span>

        {/* Title */}
        <span style={{
          flex: 1, fontSize: 13, color: '#1A1A2E',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {item.requirement?.title}
        </span>

        {/* Gap count */}
        {item.openGaps.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#E4002B', background: '#FEE2E2', borderRadius: 10, padding: '2px 8px', flexShrink: 0 }}>
            {item.openGaps.length} gap{item.openGaps.length !== 1 ? 's' : ''}
          </span>
        )}

        {/* Work products count */}
        {item.workProducts.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#0A7C59', background: '#D1FAE5', borderRadius: 10, padding: '2px 8px', flexShrink: 0 }}>
            {item.workProducts.length} doc{item.workProducts.length !== 1 ? 's' : ''}
          </span>
        )}

        {/* Published change badge */}
        {publishedChange && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', background: 'rgba(124,58,237,0.1)', borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>
            Change pending
          </span>
        )}

        <span style={{ fontSize: 11, color: '#C8D0DB', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid #E8EDF4', background: '#FAFBFC' }}>

          {/* Published control change from compliance hub */}
          {publishedChange && (
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #E8EDF4', background: '#F5F3FF' }}>
              <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Compliance Hub — Published change
              </p>
              <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>
                {publishedChange.controlChange.title}
              </p>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#4A5568', lineHeight: 1.55 }}>
                {publishedChange.controlChange.description}
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={e => { e.stopPropagation(); void mayaDocs() }}
                  disabled={mayaDocsBusy}
                  style={{
                    padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 6,
                    border: 'none', cursor: mayaDocsBusy ? 'not-allowed' : 'pointer',
                    background: mayaDocsBusy ? '#D0D7E3' : '#7C3AED', color: '#fff',
                  }}
                >
                  {mayaDocsBusy ? '⟳ Running…' : '🤖 MAYA — Update documents'}
                </button>
                {docsResult && (
                  <span style={{ fontSize: 12, color: docsResult.startsWith('Error') ? '#E4002B' : '#0A7C59', fontWeight: 600 }}>
                    {docsResult}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Open gaps */}
          {item.openGaps.length > 0 && (
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #E8EDF4' }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#9AA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Open gaps
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {item.openGaps.map(gap => (
                  <div key={gap.id} style={{
                    padding: '8px 12px', background: '#fff',
                    border: '1px solid #E8EDF4', borderRadius: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: SEV_COLOR[gap.severity] ?? '#6B7280', flexShrink: 0 }}>
                        {gap.severity}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>{gap.title}</span>
                      <span style={{ fontSize: 11, color: '#9AA3AF' }}>{gap.gapType}</span>
                    </div>
                    {gap.description && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#4A5568', lineHeight: 1.5 }}>{gap.description}</p>
                    )}
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#B8C0CC' }}>Detected {fmtDate(gap.detectedAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MAYA assess action */}
          <div style={{ padding: '12px 14px', borderBottom: item.workProducts.length > 0 ? '1px solid #E8EDF4' : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={e => { e.stopPropagation(); void mayaAssess() }}
                disabled={mayaAssessBusy}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 6,
                  border: 'none', cursor: mayaAssessBusy ? 'not-allowed' : 'pointer',
                  background: mayaAssessBusy ? '#D0D7E3' : '#003781', color: '#fff',
                }}
              >
                {mayaAssessBusy ? '⟳ Analysing…' : `🤖 MAYA — ${item.openGaps.length > 0 ? 'Re-assess gaps' : 'Assess compliance gaps'}`}
              </button>
              <span style={{ fontSize: 12, color: '#9AA3AF' }}>
                Runs AI analysis against {item.requirement?.obligationType} obligation
              </span>
              {assessResult && (
                <span style={{ fontSize: 12, fontWeight: 600, color: assessResult.startsWith('Error') ? '#E4002B' : '#0A7C59' }}>
                  {assessResult}
                </span>
              )}
            </div>
          </div>

          {/* Generated work products */}
          {item.workProducts.length > 0 && (
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #E8EDF4' }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#9AA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Generated document updates
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {item.workProducts.map(wp => <WorkProductCard key={wp.id} wp={wp} />)}
              </div>
            </div>
          )}

          {/* Confirm compliant — appears when not already compliant */}
          {!isCompliant && (
            <div style={{
              padding: '14px 14px',
              background: confirmResult?.ok ? '#F0FAF6' : '#FAFBFC',
              borderTop: item.workProducts.length > 0 ? undefined : '1px solid #E8EDF4',
            }}>
              {confirmResult?.ok ? (
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0A7C59' }}>
                  {confirmResult.message}
                </p>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={e => { e.stopPropagation(); void confirmCompliant() }}
                    disabled={confirmBusy || !signerName.trim()}
                    style={{
                      padding: '7px 18px', fontSize: 13, fontWeight: 700, borderRadius: 6,
                      border: 'none', cursor: confirmBusy || !signerName.trim() ? 'not-allowed' : 'pointer',
                      background: confirmBusy || !signerName.trim() ? '#D0D7E3' : '#0A7C59',
                      color: '#fff', whiteSpace: 'nowrap',
                    }}
                  >
                    {confirmBusy ? '⟳ Confirming…' : '✓ Confirm compliant'}
                  </button>
                  <span style={{ fontSize: 12, color: '#9AA3AF' }}>
                    Resolves gaps · assembles evidence package · logs to Evidence Centre
                  </span>
                  {confirmResult && !confirmResult.ok && (
                    <span style={{ fontSize: 12, color: '#E4002B' }}>{confirmResult.message}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ProductDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params)
  const [product, setProduct] = useState<Product | null>(null)
  const [compliance, setCompliance] = useState<ComplianceItem[]>([])
  const [inbox, setInbox] = useState<PublishedChange[]>([])
  const [loading, setLoading] = useState(true)
  const [signerName, setSignerName] = useState('Compliance Officer')

  const loadAll = useCallback(() => {
    Promise.all([
      fetch(`/api/product-hub/products/${productId}`).then(r => r.json()),
      fetch(`/api/product-hub/products/${productId}/compliance`).then(r => r.json()),
      fetch('/api/product-hub/inbox').then(r => r.json()),
    ]).then(([prod, comp, inb]: [Product, ComplianceItem[], PublishedChange[]]) => {
      setProduct(prod)
      setCompliance(Array.isArray(comp) ? comp : [])
      setInbox(Array.isArray(inb) ? inb : [])
    }).finally(() => setLoading(false))
  }, [productId])

  useEffect(() => { loadAll() }, [loadAll])

  if (loading) {
    return (
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 24px 48px' }}>
        <Link href="/product-hub" style={{ fontSize: 12, color: '#003781', textDecoration: 'none' }}>← Product Hub</Link>
        <div style={{ marginTop: 24, color: '#9AA3AF', fontSize: 13 }}>Loading…</div>
      </div>
    )
  }

  if (!product) {
    return (
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 24px 48px' }}>
        <Link href="/product-hub" style={{ fontSize: 12, color: '#003781', textDecoration: 'none' }}>← Product Hub</Link>
        <p style={{ marginTop: 24, color: '#E4002B' }}>Product not found.</p>
      </div>
    )
  }

  const crit = CRIT_CFG[product.criticality] ?? CRIT_CFG.LOW

  // Group compliance by source
  const bySource: Record<string, { sourceName: string; shortCode: string; items: ComplianceItem[] }> = {}
  for (const item of compliance) {
    if (!item.applicable) continue
    const key = item.source?.id ?? 'other'
    if (!bySource[key]) {
      bySource[key] = { sourceName: item.source?.name ?? 'Other', shortCode: item.source?.shortCode ?? '', items: [] }
    }
    bySource[key].items.push(item)
  }

  // Map requirementId → published change affecting this product
  const changeByReq: Record<string, PublishedChange> = {}
  for (const inboxItem of inbox) {
    const affects = inboxItem.affectedProducts.some(ap => ap.product.id === productId)
    if (affects) {
      changeByReq[inboxItem.controlChange.requirementId] = inboxItem
    }
  }

  const pendingChanges = inbox.filter(item =>
    item.affectedProducts.some(ap => ap.product.id === productId && ap.stage !== 'FULFILLED')
  )

  const compliantCount = compliance.filter(i => i.applicable && i.currentStatus === 'COMPLIANT').length
  const nonCompliantCount = compliance.filter(i => i.applicable && i.currentStatus === 'NON_COMPLIANT').length
  const applicableCount = compliance.filter(i => i.applicable).length

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 24px 48px' }}>

      {/* Back link */}
      <Link href="/product-hub" style={{ fontSize: 12, color: '#003781', textDecoration: 'none' }}>
        ← Product Hub
      </Link>

      {/* Product header */}
      <div style={{
        marginTop: 16, marginBottom: 24, padding: '18px 20px',
        background: '#fff', border: '1px solid #E8EDF4',
        borderRadius: 12, boxShadow: '0 1px 4px rgba(0,56,129,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#003781' }}>{product.name}</h1>
              <span style={{ fontSize: 11, fontWeight: 700, color: crit.color, background: crit.bg, borderRadius: 4, padding: '2px 7px' }}>
                {product.criticality}
              </span>
              <span style={{ fontSize: 11, color: '#9AA3AF' }}>{product.type.replace(/_/g, ' ')}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#9AA3AF', flexWrap: 'wrap' }}>
              {product.owner && <span>Owner: <strong style={{ color: '#4A5568' }}>{product.owner}</strong></span>}
              {product.hostingModel && <span>Hosting: <strong style={{ color: '#4A5568' }}>{product.hostingModel}</strong></span>}
              {product.legalEntity && <span>Entity: <strong style={{ color: '#4A5568' }}>{product.legalEntity}</strong></span>}
            </div>
          </div>

          {/* Compliance summary pills */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <div style={{ textAlign: 'center', padding: '8px 14px', background: '#F0FAF6', borderRadius: 8, border: '1px solid rgba(10,124,89,0.2)' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0A7C59' }}>{compliantCount}</div>
              <div style={{ fontSize: 10, color: '#0A7C59' }}>Compliant</div>
            </div>
            {nonCompliantCount > 0 && (
              <div style={{ textAlign: 'center', padding: '8px 14px', background: '#FEF2F2', borderRadius: 8, border: '1px solid rgba(228,0,43,0.2)' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#E4002B' }}>{nonCompliantCount}</div>
                <div style={{ fontSize: 10, color: '#E4002B' }}>Non-compliant</div>
              </div>
            )}
            <div style={{ textAlign: 'center', padding: '8px 14px', background: '#F4F6F9', borderRadius: 8, border: '1px solid #D0D7E3' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#003781' }}>{applicableCount}</div>
              <div style={{ fontSize: 10, color: '#9AA3AF' }}>Applicable</div>
            </div>
          </div>
        </div>
      </div>

      {/* Signer name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 12, color: '#9AA3AF', flexShrink: 0 }}>Confirming as</span>
        <input
          value={signerName}
          onChange={e => setSignerName(e.target.value)}
          style={{
            padding: '5px 10px', fontSize: 13, border: '1px solid #D0D7E3',
            borderRadius: 6, outline: 'none', color: '#1A1A2E', background: '#fff', width: 200,
          }}
        />
      </div>

      {/* Pending changes banner */}
      {pendingChanges.length > 0 && (
        <div style={{
          marginBottom: 20, padding: '12px 16px',
          background: '#FEF3C7', border: '1px solid rgba(180,83,9,0.3)',
          borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#B45309' }}>
            {pendingChanges.length} published control change{pendingChanges.length !== 1 ? 's' : ''} from the Compliance Hub affect this product
          </span>
          <span style={{ fontSize: 12, color: '#B45309', marginLeft: 'auto' }}>See highlighted requirements below</span>
        </div>
      )}

      {/* Compliance by regulation */}
      {Object.keys(bySource).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9AA3AF', background: '#fff', borderRadius: 10, border: '1px solid #E8EDF4' }}>
          <p style={{ fontSize: 14 }}>No applicable requirements found for this product.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Object.entries(bySource).map(([key, group]) => {
            const compliant = group.items.filter(i => i.currentStatus === 'COMPLIANT').length
            const total = group.items.length

            return (
              <section key={key}>
                {/* Regulation header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: '#003781',
                    background: 'rgba(0,55,129,0.08)', borderRadius: 4, padding: '3px 8px',
                    fontFamily: 'monospace',
                  }}>{group.shortCode}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>{group.sourceName}</span>
                  <span style={{ fontSize: 12, color: '#9AA3AF', marginLeft: 'auto' }}>
                    {compliant}/{total} compliant
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {group.items.map(item => (
                    <RequirementRow
                      key={item.applicability.id}
                      item={item}
                      publishedChange={item.requirement ? (changeByReq[item.requirement.id] ?? null) : null}
                      productId={productId}
                      signerName={signerName}
                      onRefresh={loadAll}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
