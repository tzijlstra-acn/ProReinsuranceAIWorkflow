import { NextResponse } from 'next/server'
import { getCurrentState } from '@/lib/state-machine'

export async function POST() {
  try {
    const steps: Array<{ step: string; result: unknown }> = []

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    async function callApi(path: string, method = 'POST') {
      const res = await fetch(`${baseUrl}${path}`, { method, headers: { 'Content-Type': 'application/json' } })
      return res.json()
    }

    const { state } = await getCurrentState()
    let currentState = state

    // Stage 1: Propose standard (if BASELINE)
    if (currentState === 'BASELINE') {
      const r = await callApi('/api/stage/1/propose')
      steps.push({ step: 'Stage 1: Propose standard', result: r })
      currentState = r.newState
    }

    // Stage 1 approval gate — pause
    if (currentState === 'STANDARD_PROPOSED') {
      return NextResponse.json({
        ok: true,
        paused: true,
        pauseReason: 'Approval required: Review guideline v3.3 and control BR0039-GR',
        currentState,
        steps,
      })
    }

    // Stage 2: Propose IaC
    if (currentState === 'STANDARD_APPROVED') {
      const r = await callApi('/api/stage/2/propose')
      steps.push({ step: 'Stage 2: Propose IaC', result: r })
      currentState = r.newState
    }

    // Stage 2 approval gate — pause
    if (currentState === 'IAC_PR_CREATED') {
      return NextResponse.json({
        ok: true,
        paused: true,
        pauseReason: 'Approval required: Review IaC PR and approve deployment',
        currentState,
        steps,
      })
    }

    // Stage 3: Policy evaluation (auto)
    if (currentState === 'DEPLOYED') {
      const r = await callApi('/api/stage/3/evaluate')
      steps.push({ step: 'Stage 3: Policy evaluation', result: r })
      currentState = r.newState
    }

    // Stage 4: DDCR update (auto)
    if (currentState === 'POLICY_VERIFIED') {
      const r = await callApi('/api/stage/4/update')
      steps.push({ step: 'Stage 4: DDCR update', result: r })
      currentState = r.newState
    }

    // Stage 5: Propose docs (auto)
    if (currentState === 'DDCR_UPDATED') {
      const r = await callApi('/api/stage/5/propose')
      steps.push({ step: 'Stage 5: Propose docs', result: r })
      currentState = r.newState
    }

    // Stage 5 approval gate — pause
    if (currentState === 'DOCS_PROPOSED') {
      return NextResponse.json({
        ok: true,
        paused: true,
        pauseReason: 'Approval required: Review documentation updates (SDD v2.5, OM v1.9)',
        currentState,
        steps,
      })
    }

    return NextResponse.json({ ok: true, paused: false, currentState, steps })
  } catch (err) {
    console.error('[E2E]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
