import { clsx } from 'clsx'

const STEP_LABELS = ['Define', 'Integrate', 'Verify', 'Report', 'Document', 'Prove']

// States where a specific step is awaiting human approval
const AWAITING_STATES: Record<number, string[]> = {
  1: ['STANDARD_PROPOSED'],
  2: ['IAC_PR_CREATED'],
  5: ['DOCS_PROPOSED'],
}

interface StateIndicatorProps {
  currentStage: number
  demoState: string
  selectedStage?: number
  onStageClick?: (stage: number) => void
}

type StepStatus = 'completed' | 'awaiting' | 'active' | 'not-started'

function getStepStatus(step: number, currentStage: number, demoState: string): StepStatus {
  if (step < currentStage) return 'completed'
  if (step > currentStage) return 'not-started'
  // step === currentStage
  if (AWAITING_STATES[step]?.includes(demoState)) return 'awaiting'
  return 'active'
}

function StepDot({ status }: { status: StepStatus }) {
  if (status === 'completed') {
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
        style={{ background: 'var(--color-success)', color: 'white', border: '2px solid var(--color-success)' }}
      >
        ✓
      </div>
    )
  }
  if (status === 'awaiting') {
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
        style={{ background: '#fef3cd', border: '2px solid var(--color-warning)', color: 'var(--color-warning)' }}
        title="Awaiting approval"
      >
        ⏱
      </div>
    )
  }
  if (status === 'active') {
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center animate-pulse"
        style={{ background: 'var(--mr-vibrant-blue)', border: '2px solid var(--mr-vibrant-blue)' }}
      >
        <span className="w-3 h-3 rounded-full bg-white" />
      </div>
    )
  }
  // not-started
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
      style={{ background: 'var(--mr-light-grey)', border: '2px solid var(--color-border)', color: 'var(--color-text-muted)' }}
    >
      {/* empty for not started */}
    </div>
  )
}

export function StateIndicator({ currentStage, demoState, selectedStage, onStageClick }: StateIndicatorProps) {
  const stepStatuses = STEP_LABELS.map((_, i) => getStepStatus(i + 1, currentStage, demoState))

  return (
    <div className="flex items-center gap-0 w-full">
      {STEP_LABELS.map((label, i) => {
        const step = i + 1
        const status = stepStatuses[i]
        const isSelected = selectedStage === step
        const isClickable = !!onStageClick

        return (
          <div key={step} className="flex items-center flex-1">
            <button
              onClick={() => onStageClick?.(step)}
              disabled={!isClickable}
              className={clsx(
                'flex flex-col items-center gap-1.5 px-2 py-1 rounded transition-colors flex-1',
                isClickable ? 'cursor-pointer hover:bg-[#d7ddf2]' : 'cursor-default',
                isSelected ? 'bg-[#d7ddf2]' : ''
              )}
              style={{ border: 'none', background: isSelected ? 'var(--mr-light-blue)' : undefined }}
            >
              <StepDot status={status} />
              <span
                className={clsx(
                  'text-xs text-center leading-tight',
                  status === 'completed' ? 'font-medium' : '',
                  status === 'active' || status === 'awaiting' ? 'font-semibold' : ''
                )}
                style={{
                  color: status === 'completed'
                    ? 'var(--color-success)'
                    : status === 'active'
                    ? 'var(--mr-vibrant-blue)'
                    : status === 'awaiting'
                    ? 'var(--color-warning)'
                    : 'var(--color-text-muted)',
                  fontSize: status === 'active' ? '0.8125rem' : '0.75rem',
                }}
              >
                {step}. {label}
              </span>
            </button>

            {/* Connecting line */}
            {i < STEP_LABELS.length - 1 && (
              <div
                className="h-0.5 flex-shrink-0"
                style={{
                  width: '24px',
                  background: step < currentStage ? 'var(--color-success)' : 'var(--color-border)',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
