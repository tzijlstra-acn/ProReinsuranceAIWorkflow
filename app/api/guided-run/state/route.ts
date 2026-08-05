import { NextResponse } from 'next/server'
import { createOrGetGuidedRun } from '@/lib/guided-run'

export async function GET() {
  try {
    const run = createOrGetGuidedRun()
    return NextResponse.json(run)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
