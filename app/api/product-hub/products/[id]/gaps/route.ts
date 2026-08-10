import { NextRequest, NextResponse } from 'next/server'
import { getProductGaps } from '@/lib/domain/product-hub'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const requirementId = searchParams.get('requirementId') ?? undefined
    const gaps = getProductGaps(id, requirementId)
    return NextResponse.json(gaps)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
