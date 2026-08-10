import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { regulatoryRequirements, regulatorySources } from '@/lib/db/schema'
import { getProductRequirementStatuses } from '@/lib/domain/ddcr/status-engine'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json(
        { error: 'productId query parameter is required' },
        { status: 400 }
      )
    }

    const records = getProductRequirementStatuses(productId)

    const allRequirements = db.select().from(regulatoryRequirements).all()
    const allSources = db.select().from(regulatorySources).all()

    const enriched = records.map(record => {
      const req = allRequirements.find(r => r.id === record.requirementId)
      const source = allSources.find(s => s.id === record.sourceId)
      return {
        ...record,
        title: req?.title ?? record.requirementId ?? '',
        articleRef: req?.articleRef ?? '',
        obligationType: req?.obligationType ?? '',
        obligationLevel: req?.obligationLevel ?? 'MANDATORY',
        shortCode: source?.shortCode ?? record.sourceId ?? '',
        regulationName: source?.name ?? record.sourceId ?? '',
      }
    })

    return NextResponse.json({ records: enriched })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
