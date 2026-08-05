import { NextResponse } from 'next/server'
import { patchGuidedRun, createOrGetGuidedRun } from '@/lib/guided-run'

export async function POST() {
  try {
    // Return to idle; does NOT reset artefacts or demo state machine
    const updated = patchGuidedRun({
      state: 'idle',
      currentStep: 0,
      currentAction: '',
      pausedAtApproval: false,
      approvalType: null,
      failedStep: null,
      failureMessage: null,
      completedSteps: [],
    })
    return NextResponse.json({ ok: true, guidedRun: updated })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
