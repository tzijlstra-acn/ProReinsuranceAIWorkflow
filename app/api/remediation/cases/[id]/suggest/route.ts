import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { remediationCases, products, regulatoryRequirements, regulatorySources } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAiProvider } from '@/lib/ai/provider'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rc = db.select().from(remediationCases).where(eq(remediationCases.id, id)).get()
    if (!rc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const product = db.select().from(products).where(eq(products.id, rc.productId)).get()
    const requirement = db.select().from(regulatoryRequirements).where(eq(regulatoryRequirements.id, rc.requirementId)).get()
    const source = db.select().from(regulatorySources).where(eq(regulatorySources.id, rc.sourceId)).get()

    if (!product || !requirement || !source) {
      return NextResponse.json({ error: 'Missing related records' }, { status: 400 })
    }

    const ai = getAiProvider()
    const result = await ai.suggestRemediationSteps(
      { title: rc.title, description: rc.description, status: rc.status, priority: rc.priority },
      { name: product.name, type: product.type, criticality: product.criticality },
      { articleRef: requirement.articleRef, title: requirement.title, description: requirement.description, obligationType: requirement.obligationType },
      source.shortCode
    )

    return NextResponse.json({ ok: true, suggestion: result })
  } catch (err) {
    console.error('[Suggest Remediation Steps]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
