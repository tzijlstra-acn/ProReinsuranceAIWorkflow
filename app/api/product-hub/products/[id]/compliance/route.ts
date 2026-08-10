import { NextRequest, NextResponse } from 'next/server'
import { getProductComplianceSummary } from '@/lib/domain/product-hub'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const summary = getProductComplianceSummary(id)
    return NextResponse.json(summary)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
