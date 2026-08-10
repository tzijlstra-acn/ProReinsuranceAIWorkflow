import { NextRequest, NextResponse } from 'next/server'
import { getComplianceGaps } from '@/lib/domain/compliance-hub'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? undefined
    const gaps = getComplianceGaps(status)
    return NextResponse.json(gaps)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
