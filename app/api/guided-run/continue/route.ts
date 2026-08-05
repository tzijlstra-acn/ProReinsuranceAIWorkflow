import { NextResponse } from 'next/server'
import { createOrGetGuidedRun, executeFromCurrentState, patchGuidedRun } from '@/lib/guided-run'
import { getCurrentState } from '@/lib/state-machine'

export async function POST() {
  try {
    const run = createOrGetGuidedRun()

    if (run.state !== 'awaiting_approval' && run.state !== 'paused') {
      return NextResponse.json(
        { error: `Cannot continue from state '${run.state}'. Must be awaiting_approval or paused.` },
        { status: 409 },
      )
    }

    // Verify the state machine has progressed past the expected approval gate
    const { state: demoState } = await getCurrentState()

    if (run.approvalType === 'standard' && demoState === 'STANDARD_PROPOSED') {
      return NextResponse.json(
        { error: 'Standard approval has not been recorded yet — approve the standard first' },
        { status: 409 },
      )
    }
    if (run.approvalType === 'iac' && (demoState === 'IAC_PR_CREATED' || demoState === 'STANDARD_APPROVED')) {
      return NextResponse.json(
        { error: 'IaC approval has not been recorded yet — approve the deployment first' },
        { status: 409 },
      )
    }
    if (run.approvalType === 'docs' && (demoState === 'DOCS_PROPOSED' || demoState === 'DDCR_UPDATED')) {
      return NextResponse.json(
        { error: 'Documentation approval has not been recorded yet — approve the documents first' },
        { status: 409 },
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    patchGuidedRun({
      state: 'continuing',
      pausedAtApproval: false,
      approvalType: null,
      currentAction: 'Continuing after approval',
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
    console.error('[Guided Run Continue]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
