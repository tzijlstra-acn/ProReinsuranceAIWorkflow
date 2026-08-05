import { NextResponse } from 'next/server'
import { getAllWorkProducts } from '@/lib/ddcr-adapter'

export async function GET() {
  try {
    const wps = getAllWorkProducts('APP-X-001')
    return NextResponse.json(wps.map(w => ({ ...w, evidenceIds: JSON.parse(w.evidenceIds || '[]') })))
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
