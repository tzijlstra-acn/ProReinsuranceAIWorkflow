import { NextResponse } from 'next/server'
import { getRegulatorySources } from '@/lib/domain/compliance-hub'

export async function GET() {
  try {
    const sources = getRegulatorySources()
    return NextResponse.json(sources)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
