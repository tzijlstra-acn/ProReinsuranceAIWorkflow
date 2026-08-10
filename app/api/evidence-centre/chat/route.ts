import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import {
  products,
  regulatorySources,
  regulatoryRequirements,
  complianceGaps,
  controlChanges,
  productGaps,
  evidencePackages,
  requirementStatusHistory,
  verificationResults,
} from '@/lib/db/schema'
import { getAiProvider } from '@/lib/ai/provider'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { message: string; history?: Array<{ role: 'user' | 'assistant'; content: string }> }
    const { message, history = [] } = body

    if (!message?.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    // ── Gather context from the DB ────────────────────────────────────────────
    const allProducts = db.select().from(products).all()
    const allSources = db.select().from(regulatorySources).all()
    const allRequirements = db.select().from(regulatoryRequirements).all()
    const allGaps = db.select().from(complianceGaps).all()
    const allChanges = db.select().from(controlChanges).all()
    const allProductGaps = db.select().from(productGaps).all()
    const allPackages = db.select().from(evidencePackages).all()
    const allHistory = db.select().from(requirementStatusHistory).all()
    const allVerResults = db.select().from(verificationResults).all()

    const context = buildContext({
      products: allProducts,
      sources: allSources,
      requirements: allRequirements,
      gaps: allGaps,
      changes: allChanges,
      productGaps: allProductGaps,
      packages: allPackages,
      history: allHistory,
      verResults: allVerResults,
    })

    const ai = getAiProvider()
    const answer = await ai.answerEvidenceChatMessage(message, context, history)

    return NextResponse.json({ answer })
  } catch (err) {
    console.error('[Evidence Chat]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

type DbProduct = { id: string; name: string; criticality: string; status: string }
type DbSource = { id: string; shortCode: string; name: string }
type DbRequirement = { id: string; sourceId: string; articleRef: string; title: string; obligationType: string; obligationLevel: string }
type DbGap = { id: string; requirementId: string; sourceId: string; title: string; description: string; severity: string; status: string; detectedAt: string }
type DbChange = { id: string; requirementId: string; title: string; changeType: string; status: string; approvedBy: string | null }
type DbProductGap = { id: string; productId: string; requirementId: string; title: string; gapType: string; severity: string; status: string }
type DbPackage = { id: string; productId: string; requirementId: string; status: string; approvedBy: string | null; approvedAt: string | null }
type DbHistory = { id: string; productId: string; requirementId: string; status: string; previousStatus: string | null; reason: string | null; transitionedAt: string; transitionedBy: string | null }
type DbVerResult = { id: string; productId: string; requirementId: string; criterionId: string; status: string; verifiedAt: string }

function buildContext(data: {
  products: DbProduct[]
  sources: DbSource[]
  requirements: DbRequirement[]
  gaps: DbGap[]
  changes: DbChange[]
  productGaps: DbProductGap[]
  packages: DbPackage[]
  history: DbHistory[]
  verResults: DbVerResult[]
}): string {
  const lines: string[] = []

  lines.push('=== PLATFORM DATA SNAPSHOT ===')
  lines.push(`Products: ${data.products.length}`)
  lines.push(`Regulatory sources: ${data.sources.map(s => s.shortCode).join(', ')}`)
  lines.push(`Requirements: ${data.requirements.length}`)
  lines.push('')

  lines.push('=== PRODUCTS ===')
  for (const p of data.products) {
    lines.push(`${p.name} (${p.id}) — criticality: ${p.criticality}, status: ${p.status}`)
  }
  lines.push('')

  lines.push('=== REGULATORY REQUIREMENTS ===')
  for (const r of data.requirements) {
    const src = data.sources.find(s => s.id === r.sourceId)
    lines.push(`${src?.shortCode ?? r.sourceId} ${r.articleRef}: ${r.title} [${r.obligationType} / ${r.obligationLevel}]`)
  }
  lines.push('')

  lines.push('=== COMPLIANCE GAPS ===')
  if (data.gaps.length === 0) lines.push('None')
  for (const g of data.gaps) {
    lines.push(`[${g.status}] ${g.title} — severity: ${g.severity}, detected: ${g.detectedAt}`)
    lines.push(`  ${g.description}`)
  }
  lines.push('')

  lines.push('=== CONTROL CHANGES ===')
  if (data.changes.length === 0) lines.push('None')
  for (const c of data.changes) {
    const req = data.requirements.find(r => r.id === c.requirementId)
    lines.push(`[${c.status}] ${c.title} (${c.changeType}) — ${req?.articleRef ?? c.requirementId}${c.approvedBy ? `, approved by ${c.approvedBy}` : ''}`)
  }
  lines.push('')

  lines.push('=== PRODUCT-LEVEL GAPS ===')
  if (data.productGaps.length === 0) lines.push('None')
  for (const g of data.productGaps) {
    const prod = data.products.find(p => p.id === g.productId)
    const req = data.requirements.find(r => r.id === g.requirementId)
    lines.push(`[${g.status}] ${prod?.name ?? g.productId} — ${req?.articleRef ?? g.requirementId}: ${g.title} (${g.gapType}, ${g.severity})`)
  }
  lines.push('')

  lines.push('=== EVIDENCE PACKAGES ===')
  if (data.packages.length === 0) lines.push('None')
  for (const ep of data.packages) {
    const prod = data.products.find(p => p.id === ep.productId)
    const req = data.requirements.find(r => r.id === ep.requirementId)
    lines.push(`[${ep.status}] ${prod?.name ?? ep.productId} / ${req?.articleRef ?? ep.requirementId}${ep.approvedBy ? ` — approved by ${ep.approvedBy} on ${ep.approvedAt}` : ''}`)
  }
  lines.push('')

  lines.push('=== REQUIREMENT STATUS HISTORY (most recent 20) ===')
  const recentHistory = [...data.history].sort((a, b) => b.transitionedAt.localeCompare(a.transitionedAt)).slice(0, 20)
  for (const h of recentHistory) {
    const prod = data.products.find(p => p.id === h.productId)
    const req = data.requirements.find(r => r.id === h.requirementId)
    const prev = h.previousStatus ? ` from ${h.previousStatus}` : ''
    lines.push(`${h.transitionedAt.slice(0, 10)} — ${prod?.name ?? h.productId} / ${req?.articleRef ?? h.requirementId}: ${h.previousStatus ?? 'initial'}${prev} → ${h.status}${h.transitionedBy ? ` by ${h.transitionedBy}` : ''}`)
    if (h.reason) lines.push(`  Reason: ${h.reason}`)
  }
  lines.push('')

  lines.push('=== VERIFICATION RESULTS ===')
  if (data.verResults.length === 0) lines.push('None')
  for (const vr of data.verResults) {
    const prod = data.products.find(p => p.id === vr.productId)
    const req = data.requirements.find(r => r.id === vr.requirementId)
    lines.push(`[${vr.status}] ${prod?.name ?? vr.productId} / ${req?.articleRef ?? vr.requirementId} — criterion: ${vr.criterionId}, verified: ${vr.verifiedAt.slice(0, 10)}`)
  }

  return lines.join('\n')
}
