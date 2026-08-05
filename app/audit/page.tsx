'use client'
import { useState } from 'react'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'

interface AuditSection { heading: string; content: string }
interface EvidenceItem { id: string; label: string; type: string; link?: string }
interface AuditAnswer {
  directResponse: string
  sections: AuditSection[]
  evidenceList: EvidenceItem[]
  disclaimer: string
  provenance: { provider: string; model: string; promptVersion: string; generatedAt: string }
}

export default function AuditPage() {
  const [question, setQuestion] = useState('How does GT fulfil the data backup requirements associated with DORA Article 12?')
  const [answer, setAnswer] = useState<AuditAnswer | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getAnswer = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/audit/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setAnswer(data.answer)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const renderMarkdown = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code class="bg-[#F4F6F9] text-[#003781] px-1.5 py-0.5 rounded text-xs font-mono border border-[#D0D7E3]">$1</code>')
      .replace(/\n/g, '<br />')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#003781]">Audit Evidence Answer</h1>
        <p className="text-[#4A5568] text-sm mt-1">
          RQMT-style evidence response — generated from the full compliance evidence graph
        </p>
      </div>

      {/* Question input */}
      <div className="bg-white border border-[#D0D7E3] rounded-lg p-5" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
        <label className="block text-[#4A5568] text-xs font-medium mb-2">Audit Question</label>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          rows={2}
          className="w-full bg-[#F4F6F9] border border-[#D0D7E3] rounded-md px-3 py-2 text-[#1A1A2E] text-sm focus:outline-none focus:border-[#003781] resize-none mb-3"
        />
        <button
          onClick={getAnswer}
          disabled={loading}
          className="px-5 py-2 bg-[#003781] hover:bg-[#0066B2] text-white text-sm rounded-md font-medium disabled:opacity-50"
        >
          {loading ? 'Generating answer...' : 'Generate Evidence Answer (AI)'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-[#E4002B]/10 border border-[#E4002B]/30 rounded-md text-[#E4002B] text-sm">{error}</div>
      )}

      {answer && (
        <div className="space-y-4">
          {/* Provenance */}
          <div className="flex items-center gap-3">
            <ProvenanceBadge provenance={answer.provenance} />
          </div>

          {/* Direct response */}
          <div className="bg-[#003781]/10 border border-[#003781]/30 rounded-lg p-5">
            <h2 className="text-[#003781] text-sm font-semibold uppercase tracking-wider mb-3">Response</h2>
            <p className="text-[#1A1A2E] text-base leading-relaxed">{answer.directResponse}</p>
          </div>

          {/* Sections */}
          {answer.sections.map((section, i) => (
            <div key={i} className="bg-white border border-[#D0D7E3] rounded-lg p-5" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
              <h3 className="text-[#1A1A2E] font-semibold mb-3 text-sm">{section.heading}</h3>
              <div
                className="text-[#4A5568] text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(section.content) }}
              />
            </div>
          ))}

          {/* Evidence list */}
          <div className="bg-white border border-[#D0D7E3] rounded-lg p-5" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
            <h3 className="text-[#1A1A2E] font-semibold mb-4 text-sm">Evidence References</h3>
            <div className="space-y-2">
              {answer.evidenceList.map(item => (
                <div key={item.id} className="flex items-center gap-3 text-sm">
                  <span className="text-[#4A5568]/60 font-mono text-xs w-10">{item.id}</span>
                  <span className="text-[#4A5568] text-xs bg-[#F4F6F9] px-2 py-0.5 rounded border border-[#D0D7E3]">{item.type}</span>
                  {item.link ? (
                    <a href={item.link} target="_blank" rel="noreferrer" className="text-[#003781] hover:text-[#0066B2] underline">
                      {item.label}
                    </a>
                  ) : (
                    <span className="text-[#1A1A2E]">{item.label}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-[#B45309]/10 border border-[#B45309]/30 rounded-lg p-4">
            <p className="text-[#B45309] text-xs">{answer.disclaimer}</p>
          </div>
        </div>
      )}
    </div>
  )
}
