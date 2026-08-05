import { NextResponse } from 'next/server'
import { createOrGetGuidedRun, executeFromCurrentState, patchGuidedRun } from '@/lib/guided-run'

export async function POST() {
  try {
    const run = createOrGetGuidedRun()

    // Refuse to start if already actively running
    if (run.state === 'running' || run.state === 'continuing') {
      return NextResponse.json({ error: 'Guided run is already executing' }, { status: 409 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    // Transition to running
    patchGuidedRun({
      state: 'running',
      pausedAtApproval: false,
      approvalType: null,
      failedStep: null,
      failureMessage: null,
      currentAction: 'Starting guided run',
    })

    const result = await executeFromCurrentState(baseUrl)
    const updatedRun = createOrGetGuidedRun()

    return NextResponse.json({
      ok: true,
      guidedRun: updatedRun,
      paused: result.paused,
      approvalType: result.approvalType,
      completed: result.completed,
      completedInThisRun: result.completedInThisRun,
    })
  } catch (err) {
    console.error('[Guided Run Start]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
