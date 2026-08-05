'use client'
import { useState } from 'react'

interface ApprovalModalProps {
  isOpen: boolean
  title: string
  description: string
  /** When provided together with guidedMode, the modal calls this API directly */
  approveApiPath?: string
  /** Enables guided-mode: approve → confirmation → guided-run/continue → close */
  guidedMode?: boolean
  onApprove: (comment: string, reviewer: string) => Promise<void> | void
  onReject: (comment: string, reviewer: string) => Promise<void> | void
  onClose: () => void
}

type ModalStep = 'form' | 'confirmed'

export function ApprovalModal({
  isOpen,
  title,
  description,
  approveApiPath,
  guidedMode = false,
  onApprove,
  onReject,
  onClose,
}: ApprovalModalProps) {
  const [comment, setComment] = useState('')
  const [reviewer, setReviewer] = useState('Compliance Review Board')
  const [loading, setLoading] = useState(false)
  const [modalStep, setModalStep] = useState<ModalStep>('form')
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  // ── Guided mode: modal handles the full approve → continue sequence ───────
  const handleGuidedApprove = async () => {
    if (!approveApiPath) return
    setLoading(true)
    setError(null)
    try {
      // 1. Call the approve endpoint
      const res = await fetch(approveApiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'approved', reviewerComment: comment, reviewerName: reviewer }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Approval failed')
        setLoading(false)
        return
      }

      // 2. Show confirmation state for 1.5 s
      setModalStep('confirmed')
      await new Promise(resolve => setTimeout(resolve, 1500))

      // 3. Call guided-run/continue
      await fetch('/api/guided-run/continue', { method: 'POST' })

      // 4. Notify parent (triggers page refresh / state poll)
      onApprove(comment, reviewer)
    } catch (err) {
      setError(String(err))
      setLoading(false)
      setModalStep('form')
    }
  }

  // ── Standard (non-guided) mode ───────────────────────────────────────────
  const handle = async (action: 'approve' | 'reject') => {
    setLoading(true)
    setError(null)
    try {
      if (action === 'approve') await Promise.resolve(onApprove(comment, reviewer))
      else await Promise.resolve(onReject(comment, reviewer))
    } finally {
      setLoading(false)
    }
  }

  // ── Confirmed state UI ───────────────────────────────────────────────────
  if (modalStep === 'confirmed') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div
          className="relative bg-white border border-[#D0D7E3] rounded-lg shadow-xl w-full max-w-lg p-8 flex flex-col items-center gap-4"
          style={{ boxShadow: '0 4px 24px rgba(0,56,129,0.12)' }}
        >
          <div className="w-12 h-12 rounded-full bg-[#0A7C59]/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-[#0A7C59]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-[#0A7C59] font-semibold text-lg">Approved</p>
          <p className="text-[#4A5568] text-sm">Continuing workflow…</p>
        </div>
      </div>
    )
  }

  // ── Form state UI ────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white border border-[#D0D7E3] rounded-lg shadow-xl w-full max-w-lg p-6"
        style={{ boxShadow: '0 4px 24px rgba(0,56,129,0.12)' }}
      >
        <h2 className="text-lg font-semibold text-[#1A1A2E] mb-2">{title}</h2>
        <p className="text-[#4A5568] text-sm mb-6">{description}</p>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs text-[#4A5568] mb-1.5 font-medium">Reviewer Name</label>
            <input
              type="text"
              value={reviewer}
              onChange={e => setReviewer(e.target.value)}
              className="w-full bg-[#F4F6F9] border border-[#D0D7E3] rounded-md px-3 py-2 text-[#1A1A2E] text-sm focus:outline-none focus:border-[#003781]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#4A5568] mb-1.5 font-medium">Reviewer Comment (optional)</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              placeholder="Add any review notes..."
              className="w-full bg-[#F4F6F9] border border-[#D0D7E3] rounded-md px-3 py-2 text-[#1A1A2E] text-sm focus:outline-none focus:border-[#003781] resize-none"
            />
          </div>
          {error && (
            <p className="text-[#E4002B] text-xs bg-[#E4002B]/5 border border-[#E4002B]/20 rounded px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-[#4A5568] hover:text-[#1A1A2E] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          {!guidedMode && (
            <button
              onClick={() => handle('reject')}
              disabled={loading}
              className="px-4 py-2 text-sm bg-[#E4002B]/10 hover:bg-[#E4002B]/20 text-[#E4002B] border border-[#E4002B]/30 rounded-md transition-colors disabled:opacity-50"
            >
              Reject
            </button>
          )}
          {guidedMode ? (
            <button
              onClick={handleGuidedApprove}
              disabled={loading}
              className="px-4 py-2 text-sm bg-[#003781] hover:bg-[#0066B2] text-white rounded-md transition-colors disabled:opacity-50 font-medium"
            >
              {loading ? 'Processing...' : 'Approve'}
            </button>
          ) : (
            <button
              onClick={() => handle('approve')}
              disabled={loading}
              className="px-4 py-2 text-sm bg-[#003781] hover:bg-[#0066B2] text-white rounded-md transition-colors disabled:opacity-50 font-medium"
            >
              {loading ? 'Processing...' : 'Approve'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
