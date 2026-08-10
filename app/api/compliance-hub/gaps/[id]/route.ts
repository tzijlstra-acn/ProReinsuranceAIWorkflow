import { NextRequest, NextResponse } from 'next/server'
import { getComplianceGap } from '@/lib/domain/compliance-hub'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const gap = getComplianceGap(id)
    if (!gap) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(gap)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
