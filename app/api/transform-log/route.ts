import { NextResponse } from 'next/server'
import { readTransformLog } from '@/lib/fs-service'

export async function GET() {
  try {
    const log = readTransformLog()
    return NextResponse.json({ entries: log, count: log.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
