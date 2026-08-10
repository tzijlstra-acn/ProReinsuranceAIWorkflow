import { NextResponse } from 'next/server'
import {
  transitionToCompliant,
  recomputeAggregates,
} from '@/lib/domain/ddcr/status-engine'

interface TransitionPayload {
  productId: string
  requirementId: string
  sourceId: string
  approvedBy: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<TransitionPayload>
    const { productId, requirementId, sourceId, approvedBy } = body

    if (!productId || !requirementId || !sourceId || !approvedBy) {
      return NextResponse.json(
        {
          ok: false,
          error: 'productId, requirementId, sourceId, and approvedBy are all required',
        },
        { status: 400 }
      )
    }

    const result = transitionToCompliant(productId, requirementId, sourceId, approvedBy)

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: result.error,
        blockers: result.blockers ?? [],
      })
    }

    // Recompute regulation-level and product-level aggregates
    recomputeAggregates(productId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
