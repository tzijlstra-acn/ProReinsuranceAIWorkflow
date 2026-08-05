'use client'
import { useState } from 'react'
import { clsx } from 'clsx'
import { DocumentDiff } from './DocumentDiff'

export interface DocVersion {
  id: string
  version: string
  content: string
  proposedContent: string | null
  status: string
  createdAt?: string | null
  approvalId?: string | null
}

export interface ViewerDocument {
  id: string
  title: string
  type: string
  versions: DocVersion[]
}

interface DocumentViewerProps {
  isOpen: boolean
  onClose: () => void
  document: ViewerDocument | null
  canApprove?: boolean
  onApprove?: () => void
}

export function DocumentViewer({
  isOpen,
  onClose,
  document: doc,
  canApprove = false,
  onApprove,
}: DocumentViewerProps) {
  const [downloadingJson, setDownloadingJson] = useState(false)
  const [downloadingMd, setDownloadingMd] = useState(false)

  if (!isOpen || !doc) return null

  const activeVersion = doc.versions.find(v => v.status === 'active') ?? doc.versions[0]
  const proposedVersion = doc.versions.find(v => v.status === 'proposed')
  const approvedVersion = doc.versions.find(v => v.status === 'approved')

  const displayedCurrent = activeVersion?.content ?? ''
  const displayedProposed =
    proposedVersion?.proposedContent ?? proposedVersion?.content ?? ''

  const safeTitle = doc.title.replace(/[^a-zA-Z0-9]/g, '-')
  const today = new Date().toISOString().split('T')[0]

  const downloadEvidenceJson = async () => {
    setDownloadingJson(true)
    try {
      const res = await fetch(`/api/evidence-pack?documentId=${encodeURIComponent(doc.id)}`)
      const data: unknown = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = `evidence-${safeTitle}-${today}.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloadingJson(false)
    }
  }

  const downloadMarkdown = async () => {
    setDownloadingMd(true)
    try {
      const res = await fetch(`/api/evidence-pack?documentId=${encodeURIComponent(doc.id)}`)
      const data = await res.json() as { markdown?: string }
      if (data.markdown) {
        const blob = new Blob([data.markdown], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = window.document.createElement('a')
        a.href = url
        a.download = `evidence-${safeTitle}-${today}.md`
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setDownloadingMd(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-[#D0D7E3] rounded-lg shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col" style={{ boxShadow: '0 4px 24px rgba(0,56,129,0.12)' }}>

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[#D0D7E3] flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-[#1A1A2E]">{doc.title}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {activeVersion && (
                <span className="px-2 py-0.5 bg-[#F4F6F9] text-[#4A5568] text-xs rounded border border-[#D0D7E3]">
                  Current v{activeVersion.version}
                </span>
              )}
              {proposedVersion && (
                <span className="px-2 py-0.5 bg-[#003781]/10 text-[#003781] text-xs rounded border border-[#003781]/30">
                  Proposed v{proposedVersion.version}
                </span>
              )}
              {approvedVersion && (
                <span className="px-2 py-0.5 bg-[#0A7C59]/10 text-[#0A7C59] text-xs rounded border border-[#0A7C59]/30">
                  Approved v{approvedVersion.version}
                </span>
              )}
              <span className="text-[#4A5568]/60 text-xs">Author: AI-generated</span>
              {(proposedVersion ?? approvedVersion)?.createdAt && (
                <span className="text-[#4A5568]/60 text-xs">
                  {new Date((proposedVersion ?? approvedVersion)!.createdAt!).toLocaleString()}
                </span>
              )}
              {(proposedVersion?.status === 'proposed' || approvedVersion?.status === 'approved') && (
                <span className={clsx(
                  'px-2 py-0.5 text-xs rounded font-medium border',
                  approvedVersion ? 'bg-[#0A7C59]/10 text-[#0A7C59] border-[#0A7C59]/30' :
                    'bg-[#B45309]/10 text-[#B45309] border-[#B45309]/30'
                )}>
                  {approvedVersion ? 'Approved' : 'Pending Approval'}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-4 text-[#4A5568] hover:text-[#1A1A2E] transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {proposedVersion ? (
            <>
              <p className="text-[#4A5568] text-xs mb-3">
                Diff — v{activeVersion?.version ?? '?'} (current, left) → v{proposedVersion.version} (proposed, right). Red = removed · Green = added.
              </p>
              <DocumentDiff
                currentContent={displayedCurrent}
                proposedContent={displayedProposed}
              />
            </>
          ) : (
            <>
              <p className="text-[#4A5568] text-xs mb-3">No proposed version — showing current content.</p>
              <pre className="bg-[#F4F6F9] border border-[#D0D7E3] rounded-lg p-4 text-xs text-[#4A5568] overflow-auto max-h-96 whitespace-pre-wrap">
                {displayedCurrent}
              </pre>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-[#D0D7E3] flex-shrink-0 bg-[#F4F6F9] rounded-b-lg">
          <div className="flex gap-2">
            <button
              onClick={downloadEvidenceJson}
              disabled={downloadingJson}
              className="px-3 py-1.5 text-xs bg-white hover:bg-[#F4F6F9] text-[#4A5568] border border-[#D0D7E3] rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              {downloadingJson ? 'Exporting…' : 'Export Evidence (.json)'}
            </button>
            <button
              onClick={downloadMarkdown}
              disabled={downloadingMd}
              className="px-3 py-1.5 text-xs bg-white hover:bg-[#F4F6F9] text-[#4A5568] border border-[#D0D7E3] rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              {downloadingMd ? 'Generating…' : 'Download Markdown'}
            </button>
          </div>

          <div className="flex gap-2 items-center">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-[#4A5568] hover:text-[#1A1A2E] transition-colors"
            >
              Close
            </button>
            {canApprove && proposedVersion && onApprove && (
              <button
                onClick={onApprove}
                className="px-4 py-1.5 text-sm bg-[#0A7C59] hover:bg-[#0A7C59]/90 text-white rounded-md font-medium transition-colors"
              >
                Approve Document
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
