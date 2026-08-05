'use client'
import { clsx } from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProcessingStep {
  id: string
  label: string
  sourceSystem?: string
  targetSystem?: string
  status: 'pending' | 'active' | 'completed' | 'failed'
}

export interface ProcessingStateProps {
  title: string
  steps: ProcessingStep[]
  elapsedMs: number
  onCancel?: () => void
}

// ─── Step sequences ───────────────────────────────────────────────────────────

export const STEP_PROCESSING_SEQUENCES: Record<number, Omit<ProcessingStep, 'status'>[]> = {
  1: [
    { id: 's1-1', label: 'Connecting to EUR-Lex source', sourceSystem: 'EUR-Lex' },
    { id: 's1-2', label: 'Reading DORA Article 12', sourceSystem: 'EUR-Lex', targetSystem: 'Normalized data' },
    { id: 's1-3', label: 'Reading Backup & Restore Guideline v1', sourceSystem: 'Product Hub', targetSystem: 'Normalized data' },
    { id: 's1-4', label: 'Parsing Control Catalogue', sourceSystem: 'Control Catalogue', targetSystem: 'Normalized data' },
    { id: 's1-5', label: 'Comparing requirement and guideline', sourceSystem: 'Maya / Mitra' },
    { id: 's1-6', label: 'Preparing proposed guideline update', targetSystem: 'Guidelines' },
    { id: 's1-7', label: 'Preparing Control Activity', targetSystem: 'Control Catalogue' },
    { id: 's1-8', label: 'Awaiting Control Owner approval', sourceSystem: 'Human' },
  ],
  2: [
    { id: 's2-1', label: 'Reading approved Control Activity', sourceSystem: 'Control Catalogue' },
    { id: 's2-2', label: 'Inspecting current Terraform configuration', sourceSystem: 'IaC Repository' },
    { id: 's2-3', label: 'Preparing Azure Backup configuration', sourceSystem: 'Copilot', targetSystem: 'IaC' },
    { id: 's2-4', label: 'Preparing geo-replication setting (GRZ)', targetSystem: 'infra/it-app-x/backup.tf' },
    { id: 's2-5', label: 'Creating pull request diff', targetSystem: 'GitHub / Azure DevOps' },
    { id: 's2-6', label: 'Awaiting technical approval', sourceSystem: 'Human' },
    { id: 's2-7', label: 'Applying simulated deployment', targetSystem: 'Azure OneCloud' },
    { id: 's2-8', label: 'Recording commit and deployment evidence', targetSystem: 'Evidence store' },
  ],
  3: [
    { id: 's3-1', label: 'Reading Azure Policy definition', sourceSystem: 'Azure Policy' },
    { id: 's3-2', label: 'Loading current Azure resource state', sourceSystem: 'Azure APIs' },
    { id: 's3-3', label: 'Evaluating backup configuration', sourceSystem: 'Azure Policy' },
    { id: 's3-4', label: 'Evaluating geo-replication (GRZ)', sourceSystem: 'Azure Policy' },
    { id: 's3-5', label: 'Writing policy evaluation result', targetSystem: 'Policy evaluation store' },
    { id: 's3-6', label: 'Updating compliance status', targetSystem: 'DDCR' },
  ],
  4: [
    { id: 's4-1', label: 'Reading Azure API response', sourceSystem: 'Azure APIs' },
    { id: 's4-2', label: 'Mapping result to DDCR work product', sourceSystem: 'AoC integration' },
    { id: 's4-3', label: 'Updating DDCR record', targetSystem: 'DDCR' },
    { id: 's4-4', label: 'Writing DDCR history event', targetSystem: 'DDCR' },
  ],
  5: [
    { id: 's5-1', label: 'Reading deployed configuration', sourceSystem: 'Azure OneCloud' },
    { id: 's5-2', label: 'Reading existing Product Hub documents', sourceSystem: 'Product Hub' },
    { id: 's5-3', label: 'Preparing SDD update', sourceSystem: 'Maya Doc Gen', targetSystem: 'Product Hub' },
    { id: 's5-4', label: 'Preparing Operating Manual update', sourceSystem: 'Maya Doc Gen', targetSystem: 'Product Hub' },
    { id: 's5-5', label: 'Awaiting document-owner approval', sourceSystem: 'Human' },
    { id: 's5-6', label: 'Creating new document versions', targetSystem: 'Product Hub' },
    { id: 's5-7', label: 'Writing document evidence', targetSystem: 'Evidence store' },
  ],
  6: [
    { id: 's6-1', label: 'Collecting approved guideline', sourceSystem: 'Product Hub' },
    { id: 's6-2', label: 'Collecting Control Activities', sourceSystem: 'Control Catalogue' },
    { id: 's6-3', label: 'Collecting Azure Policy evidence', sourceSystem: 'Azure Policy' },
    { id: 's6-4', label: 'Collecting DDCR status', sourceSystem: 'DDCR' },
    { id: 's6-5', label: 'Collecting Product Hub documents', sourceSystem: 'Product Hub' },
    { id: 's6-6', label: 'Preparing audit response', sourceSystem: 'RQMT / HCL', targetSystem: 'Evidence' },
    { id: 's6-7', label: 'Validating source references', sourceSystem: 'AoC Control Line' },
    { id: 's6-8', label: 'Creating evidence package', targetSystem: 'Evidence store' },
  ],
}

/**
 * Derive step statuses from elapsed time.
 * Steps advance naturally through the list — no artificial minimum delays.
 * If elapsedMs is large relative to totalSteps, steps complete quickly.
 */
export function deriveStepStatuses(
  steps: Omit<ProcessingStep, 'status'>[],
  elapsedMs: number,
  isComplete: boolean,
): ProcessingStep[] {
  if (isComplete) {
    return steps.map(s => ({ ...s, status: 'completed' as const }))
  }
  if (elapsedMs <= 0) {
    return steps.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' } as ProcessingStep))
  }

  // Estimate: assume each step takes ~600 ms on average (adjust naturally if faster)
  const msPerStep = 600
  const stepsCompleted = Math.min(Math.floor(elapsedMs / msPerStep), steps.length - 1)

  return steps.map((s, i) => {
    let status: ProcessingStep['status']
    if (i < stepsCompleted) status = 'completed'
    else if (i === stepsCompleted) status = 'active'
    else status = 'pending'
    return { ...s, status }
  })
}

// ─── Elapsed time formatter ───────────────────────────────────────────────────

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 1000).toFixed(1)}s`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepDot({ status }: { status: ProcessingStep['status'] }) {
  return (
    <div
      className={clsx(
        'w-3 h-3 rounded-full flex-shrink-0 transition-colors',
        {
          'bg-[#D0D7E3]': status === 'pending',
          'bg-[#003781] animate-pulse': status === 'active',
          'bg-[#0A7C59]': status === 'completed',
          'bg-[#E4002B]': status === 'failed',
        },
        // prefers-reduced-motion: no animation
        'motion-reduce:animate-none',
      )}
    />
  )
}

function SystemChip({ label, variant }: { label: string; variant: 'source' | 'target' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
        variant === 'source'
          ? 'bg-[#F4F6F9] text-[#4A5568] border border-[#D0D7E3]'
          : 'bg-[#003781]/8 text-[#003781] border border-[#003781]/20',
      )}
    >
      {variant === 'source' ? '↑' : '↓'} {label}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProcessingState({ title, steps, elapsedMs, onCancel }: ProcessingStateProps) {
  return (
    <div
      className="bg-white border border-[#D0D7E3] rounded-lg p-5"
      style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[#003781] font-semibold text-sm">{title}</h3>
        <div className="flex items-center gap-3">
          <span className="text-[#4A5568]/60 text-xs tabular-nums">{formatElapsed(elapsedMs)}</span>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-xs text-[#4A5568]/60 hover:text-[#4A5568] transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Steps list */}
      <div className="relative pl-5">
        {/* Left connector line */}
        {steps.length > 1 && (
          <div className="absolute left-[5px] top-3 bottom-3 w-px bg-[#D0D7E3]" aria-hidden />
        )}

        <ol className="space-y-3">
          {steps.map((step) => {
            const isActive = step.status === 'active'
            return (
              <li key={step.id} className="flex items-start gap-3">
                {/* Dot, vertically centred with first line of text */}
                <div className="mt-0.5 -ml-5">
                  <StepDot status={step.status} />
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={clsx(
                      'text-sm leading-snug',
                      isActive ? 'font-semibold text-[#003781]' : 'text-[#4A5568]',
                      step.status === 'completed' && 'line-through text-[#4A5568]/50',
                      step.status === 'pending' && 'text-[#4A5568]/60',
                      step.status === 'failed' && 'text-[#E4002B]',
                    )}
                  >
                    {step.label}
                  </p>

                  {/* Source / Target chips — shown only on active step */}
                  {isActive && (step.sourceSystem || step.targetSystem) && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {step.sourceSystem && <SystemChip label={step.sourceSystem} variant="source" />}
                      {step.sourceSystem && step.targetSystem && (
                        <span className="text-[#4A5568]/40 text-[10px]">→</span>
                      )}
                      {step.targetSystem && <SystemChip label={step.targetSystem} variant="target" />}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
