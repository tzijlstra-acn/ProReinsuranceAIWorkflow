import { db } from '@/lib/db/index'
import {
  remediationCases,
  products,
  regulatoryRequirements,
  regulatorySources,
} from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export function getRemediationCases(filter?: { productId?: string; status?: string }) {
  const allCases = db.select().from(remediationCases).all()
  const allProducts = db.select().from(products).all()
  const allReqs = db.select().from(regulatoryRequirements).all()
  const allSources = db.select().from(regulatorySources).all()

  let cases = allCases
  if (filter?.productId) cases = cases.filter(c => c.productId === filter.productId)
  if (filter?.status) cases = cases.filter(c => c.status === filter.status)

  return cases.map(c => ({
    ...c,
    productGapIds: JSON.parse(c.productGapIds ?? '[]') as string[],
    product: allProducts.find(p => p.id === c.productId) ?? null,
    requirement: allReqs.find(r => r.id === c.requirementId) ?? null,
    source: allSources.find(s => s.id === c.sourceId) ?? null,
  }))
}

export function getRemediationCase(id: string) {
  const c = db.select().from(remediationCases).where(eq(remediationCases.id, id)).get()
  if (!c) return null
  const product = db.select().from(products).where(eq(products.id, c.productId)).get() ?? null
  const requirement = db.select().from(regulatoryRequirements).where(eq(regulatoryRequirements.id, c.requirementId)).get() ?? null
  const source = db.select().from(regulatorySources).where(eq(regulatorySources.id, c.sourceId)).get() ?? null
  return { ...c, productGapIds: JSON.parse(c.productGapIds ?? '[]') as string[], product, requirement, source }
}

export function createRemediationCase(data: {
  productId: string
  requirementId: string
  sourceId: string
  title: string
  description?: string
  priority?: string
  assignedTo?: string
  dueDate?: string
}) {
  const id = `RC-${Date.now()}`
  db.insert(remediationCases).values({
    id,
    productId: data.productId,
    requirementId: data.requirementId,
    sourceId: data.sourceId,
    title: data.title,
    description: data.description ?? null,
    status: 'OPEN',
    priority: data.priority ?? 'MEDIUM',
    assignedTo: data.assignedTo ?? null,
    dueDate: data.dueDate ?? null,
    productGapIds: '[]',
  }).run()
  return getRemediationCase(id)
}

export function updateRemediationCaseStatus(id: string, status: string, notes?: string) {
  const now = new Date().toISOString()
  const update: Record<string, unknown> = { status }
  if (notes) update.resolutionNotes = notes
  if (status === 'RESOLVED' || status === 'CLOSED') update.resolvedAt = now
  db.update(remediationCases).set(update).where(eq(remediationCases.id, id)).run()
  return db.select().from(remediationCases).where(eq(remediationCases.id, id)).get()
}
