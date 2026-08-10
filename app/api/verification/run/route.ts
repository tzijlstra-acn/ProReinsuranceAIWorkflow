import { NextResponse } from 'next/server'
import { runVerification } from '@/lib/domain/verification/verification-engine'

interface RunPayload {
  productId: string
  requirementId: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<RunPayload>
    const { productId, requirementId } = body

    if (!productId || !requirementId) {
      return NextResponse.json(
        { error: 'productId and requirementId are required' },
        { status: 400 }
      )
    }

    const results = runVerification(productId, requirementId)

    return NextResponse.json({ results })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
