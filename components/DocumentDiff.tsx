'use client'
import { clsx } from 'clsx'

type DiffKind = 'added' | 'removed' | 'common'

interface DiffLine {
  type: DiffKind
  text: string
}

/** Build an LCS table for two string arrays (capped at 300 lines each for performance). */
function buildLcsTable(a: string[], b: string[]): number[][] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp
}

function computeDiff(current: string, proposed: string): DiffLine[] {
  // Cap inputs to avoid O(n²) slowness in degenerate cases
  const a = current.split('\n').slice(0, 300)
  const b = proposed.split('\n').slice(0, 300)
  const dp = buildLcsTable(a, b)
  const result: DiffLine[] = []

  // Iterative backtrack to avoid call-stack overflow
  let i = a.length
  let j = b.length
  const ops: DiffLine[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ type: 'common', text: a[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'added', text: b[j - 1] })
      j--
    } else {
      ops.push({ type: 'removed', text: a[i - 1] })
      i--
    }
  }

  // backtrack produces lines in reverse order
  for (let k = ops.length - 1; k >= 0; k--) {
    result.push(ops[k])
  }

  return result
}

interface DocumentDiffProps {
  currentContent: string
  proposedContent: string
}

export function DocumentDiff({ currentContent, proposedContent }: DocumentDiffProps) {
  const diff = computeDiff(currentContent, proposedContent)

  return (
    <div className="font-mono text-xs overflow-auto max-h-96 bg-white border border-[#D0D7E3] rounded-lg">
      {diff.map((line, i) => (
        <div
          key={i}
          className={clsx(
            'flex gap-2 px-3 py-px border-l-2 min-h-[1.4rem] items-start',
            line.type === 'added' && 'bg-[#0A7C59]/10 border-[#0A7C59] text-[#0A7C59]',
            line.type === 'removed' && 'bg-[#E4002B]/10 border-[#E4002B] text-[#E4002B] line-through',
            line.type === 'common' && 'border-transparent text-[#4A5568]',
          )}
        >
          <span className="w-4 flex-shrink-0 select-none text-[#D0D7E3]">
            {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
          </span>
          <span className="whitespace-pre-wrap break-all">{line.text || ' '}</span>
        </div>
      ))}
    </div>
  )
}
