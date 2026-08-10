import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import {
  requirementStatusHistory,
  controlChanges,
  complianceGaps,
  evidencePackages,
  productGaps,
  products,
  regulatoryRequirements,
  regulatorySources,
  verificationResults,
  verificationCriteria,
} from '@/lib/db/schema'

export interface LogbookEntry {
  id: string
  type: 'STATUS_CHANGE' | 'CONTROL_CHANGE' | 'GAP_DETECTED' | 'GAP_RESOLVED' | 'EVIDENCE_ASSEMBLED' | 'VERIFICATION'
  timestamp: string
  title: string
  detail: string
  actor: string | null
  productName: string | null
  regulation: string | null
  articleRef: string | null
  severity?: string
  status?: string
}

export async function GET() {
  try {
    const allProducts = db.select().from(products).all()
    const allRequirements = db.select().from(regulatoryRequirements).all()
    const allSources = db.select().from(regulatorySources).all()
    const allCriteria = db.select().from(verificationCriteria).all()

    const entries: LogbookEntry[] = []

    // ── Requirement status transitions ────────────────────────────────────────
    const history = db.select().from(requirementStatusHistory).all()
    for (const h of history) {
      const product = allProducts.find(p => p.id === h.productId)
      const req = allRequirements.find(r => r.id === h.requirementId)
      const source = allSources.find(s => s.id === h.sourceId)
      const prev = h.previousStatus ? ` from ${fmt(h.previousStatus)}` : ''
      entries.push({
        id: `rsh-${h.id}`,
        type: 'STATUS_CHANGE',
        timestamp: h.transitionedAt,
        title: `${product?.name ?? h.productId} became ${fmt(h.status)}`,
        detail: h.reason ?? `Status changed${prev} to ${fmt(h.status)} for ${req?.title ?? h.requirementId}`,
        actor: h.transitionedBy ?? null,
        productName: product?.name ?? null,
        regulation: source?.shortCode ?? null,
        articleRef: req?.articleRef ?? null,
        status: h.status,
      })
    }

    // ── Control change milestones ─────────────────────────────────────────────
    const changes = db.select().from(controlChanges).all()
    for (const cc of changes) {
      const req = allRequirements.find(r => r.id === cc.requirementId)
      const source = req ? allSources.find(s => s.id === req.sourceId) : null
      if (cc.publishedAt) {
        entries.push({
          id: `cc-pub-${cc.id}`,
          type: 'CONTROL_CHANGE',
          timestamp: cc.publishedAt,
          title: `Control change published: ${cc.title}`,
          detail: cc.description ?? cc.title,
          actor: cc.approvedBy ?? null,
          productName: null,
          regulation: source?.shortCode ?? null,
          articleRef: req?.articleRef ?? null,
          status: 'PUBLISHED',
        })
      } else if (cc.approvedAt) {
        entries.push({
          id: `cc-apr-${cc.id}`,
          type: 'CONTROL_CHANGE',
          timestamp: cc.approvedAt,
          title: `Control change approved: ${cc.title}`,
          detail: cc.description ?? cc.title,
          actor: cc.approvedBy ?? null,
          productName: null,
          regulation: source?.shortCode ?? null,
          articleRef: req?.articleRef ?? null,
          status: 'APPROVED',
        })
      }
    }

    // ── Compliance gaps detected ──────────────────────────────────────────────
    const gaps = db.select().from(complianceGaps).all()
    for (const g of gaps) {
      const source = allSources.find(s => s.id === g.sourceId)
      const req = allRequirements.find(r => r.id === g.requirementId)
      if (g.detectedAt) {
        entries.push({
          id: `gap-${g.id}`,
          type: 'GAP_DETECTED',
          timestamp: g.detectedAt,
          title: `Gap identified: ${g.title}`,
          detail: g.description,
          actor: null,
          productName: null,
          regulation: source?.shortCode ?? null,
          articleRef: req?.articleRef ?? null,
          severity: g.severity,
          status: g.status,
        })
      }
    }

    // ── Product gaps ──────────────────────────────────────────────────────────
    const pGaps = db.select().from(productGaps).all()
    for (const g of pGaps) {
      const product = allProducts.find(p => p.id === g.productId)
      const req = allRequirements.find(r => r.id === g.requirementId)
      const source = req ? allSources.find(s => s.id === req.sourceId) : null
      entries.push({
        id: `pgap-${g.id}`,
        type: 'GAP_DETECTED',
        timestamp: g.detectedAt,
        title: `Product gap: ${g.title}`,
        detail: `${product?.name ?? g.productId} — ${g.description}`,
        actor: null,
        productName: product?.name ?? null,
        regulation: source?.shortCode ?? null,
        articleRef: req?.articleRef ?? null,
        severity: g.severity,
        status: g.status,
      })
      if (g.resolvedAt && g.status === 'RESOLVED') {
        entries.push({
          id: `pgap-res-${g.id}`,
          type: 'GAP_RESOLVED',
          timestamp: g.resolvedAt,
          title: `Gap resolved: ${g.title}`,
          detail: `${product?.name ?? g.productId} — gap closed`,
          actor: null,
          productName: product?.name ?? null,
          regulation: source?.shortCode ?? null,
          articleRef: req?.articleRef ?? null,
          status: 'RESOLVED',
        })
      }
    }

    // ── Evidence packages ─────────────────────────────────────────────────────
    const packages = db.select().from(evidencePackages).all()
    for (const ep of packages) {
      const product = allProducts.find(p => p.id === ep.productId)
      const req = allRequirements.find(r => r.id === ep.requirementId)
      const source = req ? allSources.find(s => s.id === req.sourceId) : null
      const ts = ep.approvedAt ?? ep.assembledAt ?? ep.createdAt
      if (ts) {
        entries.push({
          id: `ep-${ep.id}`,
          type: 'EVIDENCE_ASSEMBLED',
          timestamp: ts,
          title: `Evidence package ${ep.status === 'COMPLETE' ? 'completed' : 'assembled'}: ${product?.name ?? ep.productId}`,
          detail: `${req?.articleRef ?? ''} ${req?.title ?? ''} — ${ep.approvedBy ? `Approved by ${ep.approvedBy}` : 'Pending approval'}`,
          actor: ep.approvedBy ?? null,
          productName: product?.name ?? null,
          regulation: source?.shortCode ?? null,
          articleRef: req?.articleRef ?? null,
          status: ep.status,
        })
      }
    }

    // ── Verification results ──────────────────────────────────────────────────
    const verResults = db.select().from(verificationResults).all()
    for (const vr of verResults) {
      const product = allProducts.find(p => p.id === vr.productId)
      const req = allRequirements.find(r => r.id === vr.requirementId)
      const source = req ? allSources.find(s => s.id === req.sourceId) : null
      const criterion = allCriteria.find(c => c.id === vr.criterionId)
      entries.push({
        id: `vr-${vr.id}`,
        type: 'VERIFICATION',
        timestamp: vr.verifiedAt,
        title: `Verification ${vr.status === 'PASSED' ? 'passed' : 'failed'}: ${criterion?.title ?? vr.criterionId}`,
        detail: vr.notes ?? criterion?.description ?? '',
        actor: null,
        productName: product?.name ?? null,
        regulation: source?.shortCode ?? null,
        articleRef: req?.articleRef ?? null,
        status: vr.status,
      })
    }

    // Sort newest first
    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

    return NextResponse.json({ entries })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

function fmt(s: string): string {
  return s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
}
