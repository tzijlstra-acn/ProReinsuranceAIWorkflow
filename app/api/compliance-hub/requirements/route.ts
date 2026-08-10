import { NextRequest, NextResponse } from 'next/server'
import { getRegulatoryRequirements } from '@/lib/domain/compliance-hub'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sourceId = searchParams.get('sourceId') ?? undefined
    const requirements = getRegulatoryRequirements(sourceId)
    return NextResponse.json(requirements)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
