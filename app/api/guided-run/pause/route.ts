import { NextResponse } from 'next/server'
import { createOrGetGuidedRun, patchGuidedRun } from '@/lib/guided-run'

export async function POST() {
  try {
    const run = createOrGetGuidedRun()

    if (run.state !== 'running' && run.state !== 'awaiting_approval') {
      return NextResponse.json(
        { error: `Cannot pause from state '${run.state}'` },
        { status: 409 },
      )
    }

    const updated = patchGuidedRun({ state: 'paused', currentAction: 'Paused by user' })
    return NextResponse.json({ ok: true, guidedRun: updated })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
