import { NextResponse } from 'next/server'
import { createOrGetGuidedRun, executeFromCurrentState, patchGuidedRun } from '@/lib/guided-run'

export async function POST() {
  try {
    const run = createOrGetGuidedRun()

    if (run.state === 'running' || run.state === 'continuing') {
      return NextResponse.json({ error: 'Guided run is already executing' }, { status: 409 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    patchGuidedRun({
      state: 'running',
      pausedAtApproval: false,
      approvalType: null,
      failedStep: null,
      failureMessage: null,
      currentAction: 'Starting guided run',
    })

    // Fire-and-forget — return immediately so the client can poll for real-time progress.
    // executeFromCurrentState updates DB state as each step completes.
    executeFromCurrentState(baseUrl).catch(err => {
      console.error('[Guided Run Start async]', err)
    })

    return NextResponse.json({ ok: true, started: true })
  } catch (err) {
    console.error('[Guided Run Start]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
