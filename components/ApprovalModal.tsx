'use client'
import { useState } from 'react'

interface ApprovalModalProps {
  isOpen: boolean
  title: string
  description: string
  onApprove: (comment: string, reviewer: string) => Promise<void> | void
  onReject: (comment: string, reviewer: string) => Promise<void> | void
  onClose: () => void
}

export function ApprovalModal({
  isOpen,
  title,
  description,
  onApprove,
  onReject,
  onClose,
}: ApprovalModalProps) {
  const [comment, setComment] = useState('')
  const [reviewer, setReviewer] = useState('Compliance Review Board')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handle = async (action: 'approve' | 'reject') => {
    setLoading(true)
    setError(null)
    try {
      if (action === 'approve') await Promise.resolve(onApprove(comment, reviewer))
      else await Promise.resolve(onReject(comment, reviewer))
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

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
          <button
            onClick={() => handle('reject')}
            disabled={loading}
            className="px-4 py-2 text-sm bg-[#E4002B]/10 hover:bg-[#E4002B]/20 text-[#E4002B] border border-[#E4002B]/30 rounded-md transition-colors disabled:opacity-50"
          >
            Reject
          </button>
          <button
            onClick={() => handle('approve')}
            disabled={loading}
            className="px-4 py-2 text-sm bg-[#003781] hover:bg-[#0066B2] text-white rounded-md transition-colors disabled:opacity-50 font-medium"
          >
            {loading ? 'Processing...' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  )
}
