import { NextResponse } from 'next/server'
import { createOrGetGuidedRun, executeFromCurrentState, patchGuidedRun } from '@/lib/guided-run'

export async function POST() {
  try {
    const run = createOrGetGuidedRun()

    if (run.state !== 'paused') {
      return NextResponse.json(
        { error: `Cannot resume from state '${run.state}'. Must be paused.` },
        { status: 409 },
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    patchGuidedRun({ state: 'running', currentAction: 'Resuming from pause' })

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
    console.error('[Guided Run Resume]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
