// ─── Types ────────────────────────────────────────────────────────────────────

export interface RegulationFixture {
  id: string
  articleId: string
  title: string
  eurLexUrl?: string
  requirements: string[]
}

export interface GuidelineProposal {
  proposedVersion: string
  proposedContent: string
  changeSummary: string
  newClauses: string[]
  provenance: AiProvenance
}

export interface ControlActivityProposal {
  code: string
  title: string
  objective: string
  implementationStatement: string
  scope: string
  frequency: string
  ownerRole: string
  evidenceRequirements: string
  automatedTestLogic: string
  exceptionLogic: string
  isDemoData: boolean
  provenance: AiProvenance
}

export interface IacProposal {
  branchName: string
  commitMessage: string
  diffContent: string
  resources: string[]
  provenance: AiProvenance
}

export interface DocProposal {
  sddSection: string
  omSection: string
  changeRationale: string
  provenance: AiProvenance
}

export interface AuditAnswer {
  directResponse: string
  sections: AuditAnswerSection[]
  evidenceList: EvidenceItem[]
  disclaimer: string
  provenance: AiProvenance
}

export interface AuditAnswerSection {
  heading: string
  content: string
}

export interface EvidenceItem {
  id: string
  label: string
  type: string
  link?: string
}

export interface AiProvenance {
  provider: string
  model: string
  promptVersion: string
  generatedAt: string
}

export interface AiProvider {
  deriveGuidelineProposal(regulation: RegulationFixture, currentGuideline: string): Promise<GuidelineProposal>
  deriveControlActivity(regulation: RegulationFixture, guidelineProposal: GuidelineProposal): Promise<ControlActivityProposal>
  generateIacProposal(appId: string, appName: string, controlCode: string): Promise<IacProposal>
  generateDocumentationProposal(appId: string, deployedConfig: Record<string, unknown>): Promise<DocProposal>
  answerAuditQuestion(question: string, context: AuditContext): Promise<AuditAnswer>
  analyzeComplianceGaps(
    requirement: { articleRef: string; title: string; description: string; obligationType: string; obligationLevel: string },
    documents: Array<{ id: string; title: string; type: string; content: string | null; status: string }>
  ): Promise<GapAnalysisResult>
  generateControlChange(
    gap: { title: string; description: string; severity: string; gapType: string; aiAnalysis: string | null },
    requirement: { articleRef: string; title: string; description: string; obligationType: string },
    sourceShortCode: string
  ): Promise<ControlChangeProposal>
  analyzeRegulatoryDelta(
    changeSummary: string,
    sourceShortCode: string,
    existingRequirements: Array<{ id: string; articleRef: string; title: string; description: string }>,
    internalDocuments: Array<{ id: string; title: string; type: string; content: string | null }>
  ): Promise<RegulatoryDeltaAnalysis>
  suggestRemediationSteps(
    caseData: { title: string; description: string | null; status: string; priority: string },
    productData: { name: string; type: string; criticality: string },
    requirementData: { articleRef: string; title: string; description: string; obligationType: string },
    regulationShortCode: string
  ): Promise<RemediationSuggestionResult>
}

export interface AuditContext {
  regulation: RegulationFixture
  portfolioCompliantCount: number
  portfolioTotalCount: number
  exceptions: string[]
  deploymentSha: string
  deploymentDate: string
  sddVersion: string
  omVersion: string
  /** Optional extra context injected by the route (transform log summary, citations, etc.) */
  additionalContext?: string
}

export interface GapAnalysisResult {
  gaps: Array<{
    title: string
    description: string
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
    gap_type: 'CONFIGURATION' | 'DOCUMENTATION' | 'PROCESS' | 'GOVERNANCE' | 'APPROVAL'
    affectedDocumentIds: string[]
    aiAnalysis: string
  }>
  coverageStatus: 'NOT_COVERED' | 'PARTIAL' | 'SUBSTANTIALLY_COVERED' | 'FULLY_COVERED'
  coverageNotes: string
  provenance: AiProvenance
}

export interface ControlChangeProposal {
  title: string
  description: string
  changeType: 'PROCESS' | 'TECHNICAL' | 'DOCUMENTATION' | 'GOVERNANCE' | 'COMBINED'
  proposedChanges: {
    summary: string
    steps: string[]
    documentsToUpdate: string[]
    technicalChanges: string
    acceptanceCriteria: string[]
  }
  estimatedEffort: string
  provenance: AiProvenance
}

export interface RegulatoryDeltaAnalysis {
  impactedRequirementIds: string[]
  newGaps: Array<{
    requirementId: string
    title: string
    description: string
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
    gap_type: 'CONFIGURATION' | 'DOCUMENTATION' | 'PROCESS' | 'GOVERNANCE' | 'APPROVAL'
    aiAnalysis: string
  }>
  summary: string
  provenance: AiProvenance
}

export interface RemediationSuggestionResult {
  steps: Array<{
    step: number
    action: string
    owner: string
    effort: string
    description: string
  }>
  timelineWeeks: number
  blockers: string[]
  summary: string
  provenance: AiProvenance
}

// ─── Model assignment constants ───────────────────────────────────────────────
// o3    → high-stakes regulatory reasoning (guideline, control design, audit answer)
// gpt-4o → Terraform code generation (deterministic enough, faster)
// gpt-4o-mini → structured template writing (docs)

const MODEL_REASONING = 'o3'          // deriveGuidelineProposal, deriveControlActivity, answerAuditQuestion
const MODEL_CODE      = 'gpt-4o'     // generateIacProposal
const MODEL_WRITING   = 'gpt-4o-mini' // generateDocumentationProposal

// ─── JSON extraction helper ───────────────────────────────────────────────────
// o3 may wrap JSON in prose ("Here is the JSON: {...}") — extract robustly

function extractJson(raw: string): string {
  const trimmed = raw.trim()
  // Happy path: entire response is JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed
  // Find first { and last } to extract embedded JSON object
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1)
  }
  // Find first [ and last ] for JSON array
  const arrStart = trimmed.indexOf('[')
  const arrEnd = trimmed.lastIndexOf(']')
  if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
    return trimmed.slice(arrStart, arrEnd + 1)
  }
  throw new Error(`Could not extract JSON from model response. Raw: ${raw.slice(0, 500)}`)
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw)
  } catch {
    const extracted = extractJson(raw)
    return JSON.parse(extracted)
  }
}

// ─── No-AI stub — surfaces a clear error instead of silently returning canned data ──

class NoAiProvider implements AiProvider {
  private fail(): never {
    throw new Error('AI not available — set OPENAI_API_KEY in .env.local and ensure the account has API credits.')
  }
  async deriveGuidelineProposal(): Promise<GuidelineProposal> { return this.fail() }
  async deriveControlActivity(): Promise<ControlActivityProposal> { return this.fail() }
  async generateIacProposal(): Promise<IacProposal> { return this.fail() }
  async generateDocumentationProposal(): Promise<DocProposal> { return this.fail() }
  async answerAuditQuestion(): Promise<AuditAnswer> { return this.fail() }
  async analyzeComplianceGaps(): Promise<GapAnalysisResult> { return this.fail() }
  async generateControlChange(): Promise<ControlChangeProposal> { return this.fail() }
  async analyzeRegulatoryDelta(): Promise<RegulatoryDeltaAnalysis> { return this.fail() }
  async suggestRemediationSteps(): Promise<RemediationSuggestionResult> { return this.fail() }
}

// ─── Rate-limit helpers ───────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))

// Minimum gap between calls per model tier (ms). o3 is 3 RPM on low tiers → 20s.
const MIN_CALL_GAP_MS: Record<string, number> = {
  o3: 20_000,
  'gpt-4o': 1_000,
  'gpt-4o-mini': 500,
}

// Track last call timestamp per model so sequential calls are spaced out.
const lastCallAt: Record<string, number> = {}

async function throttle(model: string): Promise<void> {
  const tier = model.startsWith('o3') ? 'o3' : model.startsWith('gpt-4o-mini') ? 'gpt-4o-mini' : 'gpt-4o'
  const gap = MIN_CALL_GAP_MS[tier] ?? 1_000
  const since = Date.now() - (lastCallAt[tier] ?? 0)
  if (since < gap) await sleep(gap - since)
  lastCallAt[tier] = Date.now()
}

// Retry up to maxRetries times on 429 / 503, honouring Retry-After header.
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let delay = 2_000
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const isLast = attempt === maxRetries
      const status = (err as { status?: number })?.status
      const retryable = status === 429 || status === 503

      if (!retryable || isLast) throw err

      // Respect Retry-After header if the SDK exposes it
      const headers = (err as { headers?: Record<string, string> })?.headers
      const retryAfterSec = headers?.['retry-after'] ? parseFloat(headers['retry-after']) : null
      const waitMs = retryAfterSec != null ? retryAfterSec * 1_000 : delay

      console.warn(`[AI] Rate limited (attempt ${attempt + 1}/${maxRetries + 1}), waiting ${waitMs}ms…`)
      await sleep(waitMs)
      delay = Math.min(delay * 2, 60_000) // cap at 60s
    }
  }
  // unreachable, but satisfies TS
  throw new Error('withRetry exhausted')
}

// ─── OpenAI Provider ──────────────────────────────────────────────────────────
// Model assignments:
//   o3          → deriveGuidelineProposal, deriveControlActivity, answerAuditQuestion
//   gpt-4o      → generateIacProposal
//   gpt-4o-mini → generateDocumentationProposal

class OpenAiProvider implements AiProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any

  constructor(apiKey: string) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const OpenAI = require('openai').default
    this.client = new OpenAI({ apiKey })
  }

  private provenance(model: string): AiProvenance {
    return {
      provider: 'openai',
      model,
      promptVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * Call the chat completions endpoint with throttling + retry on 429/503.
   * o3 does not support response_format: json_object or temperature — omit those params.
   * gpt-4o and gpt-4o-mini support json_object mode.
   */
  private async chat(model: string, systemPrompt: string, userPrompt: string): Promise<Record<string, unknown>> {
    const isO3 = model.startsWith('o3')

    const params = isO3
      ? {
          model,
          messages: [
            { role: 'developer', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }
      : {
          model,
          response_format: { type: 'json_object' as const },
          temperature: 0.3,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }

    await throttle(model)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await withRetry<any>(() => this.client.chat.completions.create(params))
    const raw: string = response.choices[0]?.message?.content ?? '{}'
    return safeParse(raw)
  }

  async deriveGuidelineProposal(regulation: RegulationFixture, currentGuideline: string): Promise<GuidelineProposal> {
    const model = MODEL_REASONING
    const system = `You are a regulatory compliance expert specialising in EU financial regulation. Given a regulation article and a current internal guideline, propose the minimum update needed to make the guideline compliant. Be precise and conservative — preserve all existing content, only add what is strictly required. Return a valid JSON object with exactly these keys: proposedVersion (string), proposedContent (string, the full updated guideline text), changeSummary (string, 2-3 sentences), newClauses (array of strings, each clause or change bullet).`
    const user = `Regulation:\n${JSON.stringify(regulation, null, 2)}\n\nCurrent Guideline:\n${currentGuideline}\n\nReturn only the JSON object.`
    const parsed = await this.chat(model, system, user)
    return {
      proposedVersion: String(parsed.proposedVersion ?? ''),
      proposedContent: String(parsed.proposedContent ?? ''),
      changeSummary: String(parsed.changeSummary ?? ''),
      newClauses: Array.isArray(parsed.newClauses) ? parsed.newClauses.map(String) : [],
      provenance: this.provenance(model),
    }
  }

  async deriveControlActivity(regulation: RegulationFixture, guidelineProposal: GuidelineProposal): Promise<ControlActivityProposal> {
    const model = MODEL_REASONING
    const system = `You are a GRC control designer at a European financial institution. Given a regulation and a proposed guideline update, design a specific, implementable control activity. The control must be verifiable by automated policy evaluation. Use Azure-native tooling where applicable. Return a valid JSON object with exactly these keys: code (string, like BR0039-GR), title (string, must end with "[DEMO DATA]"), objective (string), implementationStatement (string), scope (string), frequency (string), ownerRole (string), evidenceRequirements (string), automatedTestLogic (string), exceptionLogic (string), isDemoData (boolean, always true).`
    const user = `Regulation:\n${JSON.stringify(regulation, null, 2)}\n\nGuideline proposal:\n${JSON.stringify(guidelineProposal, null, 2)}\n\nDesign the control activity. Return only the JSON object.`
    const parsed = await this.chat(model, system, user)
    return {
      code: String(parsed.code ?? ''),
      title: String(parsed.title ?? ''),
      objective: String(parsed.objective ?? ''),
      implementationStatement: String(parsed.implementationStatement ?? ''),
      scope: String(parsed.scope ?? ''),
      frequency: String(parsed.frequency ?? ''),
      ownerRole: String(parsed.ownerRole ?? ''),
      evidenceRequirements: String(parsed.evidenceRequirements ?? ''),
      automatedTestLogic: String(parsed.automatedTestLogic ?? ''),
      exceptionLogic: String(parsed.exceptionLogic ?? ''),
      isDemoData: true,
      provenance: this.provenance(model),
    }
  }

  async generateIacProposal(appId: string, appName: string, controlCode: string): Promise<IacProposal> {
    const model = MODEL_CODE
    const system = `You are a Terraform engineer at a financial services firm. Generate Infrastructure-as-Code for Azure backup geo-redundancy. Return a valid JSON object with exactly these keys: branchName (string), commitMessage (string), diffContent (string, Terraform HCL), resources (array of strings, resource addresses).`
    const user = `Application: ${appId} (${appName})\nControl: ${controlCode}\n\nGenerate Terraform HCL to create: (1) Azure Recovery Services Vault with storage_mode_type = GeoRedundant, (2) VM backup policy daily at 02:00 with 30-day retention, (3) backup protected VM. Add comments referencing DORA Article 12 §2 and the control. Prefix all comments noting this is [DEMO DATA]. Return only the JSON object.`
    const parsed = await this.chat(model, system, user)
    return {
      branchName: String(parsed.branchName ?? `feature/aoc-${controlCode.toLowerCase()}-${appId.toLowerCase()}`),
      commitMessage: String(parsed.commitMessage ?? ''),
      diffContent: String(parsed.diffContent ?? ''),
      resources: Array.isArray(parsed.resources) ? parsed.resources.map(String) : [],
      provenance: this.provenance(model),
    }
  }

  async generateDocumentationProposal(appId: string, deployedConfig: Record<string, unknown>): Promise<DocProposal> {
    const model = MODEL_WRITING
    const system = `You are a technical writer at a financial services firm. Generate documentation updates for an IT system's backup configuration. Return a valid JSON object with exactly these keys: sddSection (string, markdown), omSection (string, markdown), changeRationale (string).`
    const user = `Application: ${appId}\nDeployed config: ${JSON.stringify(deployedConfig, null, 2)}\n\nWrite: (1) SDD Section 5 "Backup & Recovery" covering the geo-redundant vault deployment, DORA Article 12 compliance, and restore procedure; (2) Operating Manual Section 3.2 "Data Backup" with vault name, schedule, GRZ storage note, and restore steps. Include [DEMO DATA] and simulated deployment disclaimers throughout. Return only the JSON object.`
    const parsed = await this.chat(model, system, user)
    return {
      sddSection: String(parsed.sddSection ?? ''),
      omSection: String(parsed.omSection ?? ''),
      changeRationale: String(parsed.changeRationale ?? ''),
      provenance: this.provenance(model),
    }
  }

  async answerAuditQuestion(question: string, context: AuditContext): Promise<AuditAnswer> {
    const model = MODEL_REASONING
    const system = `You are a senior GRC audit specialist responding to a regulatory audit question. Answer using only the verified evidence context provided. Be authoritative and precise. Do NOT invent any facts beyond what is in the context. Return a valid JSON object with exactly these keys: directResponse (string), sections (array of {heading: string, content: string}), evidenceList (array of {id: string, label: string, type: string, link?: string}), disclaimer (string).`
    const user = `Audit question: "${question}"\n\nEvidence context:\n${JSON.stringify(context, null, 2)}\n\nReturn only the JSON object.`
    const parsed = await this.chat(model, system, user)
    return {
      directResponse: String(parsed.directResponse ?? ''),
      sections: Array.isArray(parsed.sections)
        ? (parsed.sections as Array<{heading?: unknown; content?: unknown}>).map(s => ({ heading: String(s.heading ?? ''), content: String(s.content ?? '') }))
        : [],
      evidenceList: Array.isArray(parsed.evidenceList)
        ? (parsed.evidenceList as Array<{id?: unknown; label?: unknown; type?: unknown; link?: unknown}>).map(e => ({
            id: String(e.id ?? ''),
            label: String(e.label ?? ''),
            type: String(e.type ?? ''),
            link: e.link ? String(e.link) : undefined,
          }))
        : [],
      disclaimer: String(parsed.disclaimer ?? ''),
      provenance: this.provenance(model),
    }
  }

  async analyzeComplianceGaps(
    requirement: { articleRef: string; title: string; description: string; obligationType: string; obligationLevel: string },
    documents: Array<{ id: string; title: string; type: string; content: string | null; status: string }>
  ): Promise<GapAnalysisResult> {
    const model = MODEL_REASONING
    const system = `You are a regulatory compliance analyst at a European financial institution. Given a regulatory requirement and a set of internal documents, identify specific compliance gaps — areas where the documents do not fully satisfy the requirement. Be precise: cite specific missing elements, not vague generalities. Return a valid JSON object.`
    const docSummaries = documents.map(d => ({
      id: d.id,
      title: d.title,
      type: d.type,
      status: d.status,
      contentExcerpt: d.content ? d.content.slice(0, 2000) : null,
    }))
    const user = `Regulatory requirement:\n${JSON.stringify(requirement, null, 2)}\n\nInternal documents:\n${JSON.stringify(docSummaries, null, 2)}\n\nReturn a JSON object with exactly these keys:\n- gaps: array of objects, each with: title (string), description (string), severity ("CRITICAL"|"HIGH"|"MEDIUM"|"LOW"), gap_type ("CONFIGURATION"|"DOCUMENTATION"|"PROCESS"|"GOVERNANCE"|"APPROVAL"), affectedDocumentIds (array of document id strings from the input), aiAnalysis (string)\n- coverageStatus: one of "NOT_COVERED"|"PARTIAL"|"SUBSTANTIALLY_COVERED"|"FULLY_COVERED"\n- coverageNotes: string\n\nReturn only the JSON object.`
    const parsed = await this.chat(model, system, user)
    const rawGaps = Array.isArray(parsed.gaps) ? parsed.gaps as Array<Record<string, unknown>> : []
    return {
      gaps: rawGaps.map(g => ({
        title: String(g.title ?? ''),
        description: String(g.description ?? ''),
        severity: (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(String(g.severity)) ? String(g.severity) : 'MEDIUM') as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
        gap_type: (['CONFIGURATION', 'DOCUMENTATION', 'PROCESS', 'GOVERNANCE', 'APPROVAL'].includes(String(g.gap_type)) ? String(g.gap_type) : 'PROCESS') as 'CONFIGURATION' | 'DOCUMENTATION' | 'PROCESS' | 'GOVERNANCE' | 'APPROVAL',
        affectedDocumentIds: Array.isArray(g.affectedDocumentIds) ? g.affectedDocumentIds.map(String) : [],
        aiAnalysis: String(g.aiAnalysis ?? ''),
      })),
      coverageStatus: (['NOT_COVERED', 'PARTIAL', 'SUBSTANTIALLY_COVERED', 'FULLY_COVERED'].includes(String(parsed.coverageStatus)) ? String(parsed.coverageStatus) : 'PARTIAL') as 'NOT_COVERED' | 'PARTIAL' | 'SUBSTANTIALLY_COVERED' | 'FULLY_COVERED',
      coverageNotes: String(parsed.coverageNotes ?? ''),
      provenance: this.provenance(model),
    }
  }

  async generateControlChange(
    gap: { title: string; description: string; severity: string; gapType: string; aiAnalysis: string | null },
    requirement: { articleRef: string; title: string; description: string; obligationType: string },
    sourceShortCode: string
  ): Promise<ControlChangeProposal> {
    const model = MODEL_REASONING
    const system = `You are a GRC control designer at a European financial institution. Given a compliance gap identified during a regulatory analysis, design a specific, actionable control change to remediate it. The proposal must be concrete and implementable. Return a valid JSON object.`
    const user = `Compliance gap:\n- title: ${gap.title}\n- description: ${gap.description}\n- severity: ${gap.severity}\n- gap_type: ${gap.gapType}\n- ai_analysis: ${gap.aiAnalysis ?? 'N/A'}\n\nRequirement context:\n- articleRef: ${requirement.articleRef}\n- title: ${requirement.title}\n- description: ${requirement.description}\n- obligation_type: ${requirement.obligationType}\n- regulation: ${sourceShortCode}\n\nReturn a JSON object with exactly these keys:\n- title: string\n- description: string\n- changeType: one of "PROCESS"|"TECHNICAL"|"DOCUMENTATION"|"GOVERNANCE"|"COMBINED"\n- proposedChanges: object with: summary (string), steps (array of strings), documentsToUpdate (array of strings), technicalChanges (string), acceptanceCriteria (array of strings)\n- estimatedEffort: string\n\nReturn only the JSON object.`
    const parsed = await this.chat(model, system, user)
    const pc = (parsed.proposedChanges ?? {}) as Record<string, unknown>
    return {
      title: String(parsed.title ?? ''),
      description: String(parsed.description ?? ''),
      changeType: (['PROCESS', 'TECHNICAL', 'DOCUMENTATION', 'GOVERNANCE', 'COMBINED'].includes(String(parsed.changeType)) ? String(parsed.changeType) : 'PROCESS') as 'PROCESS' | 'TECHNICAL' | 'DOCUMENTATION' | 'GOVERNANCE' | 'COMBINED',
      proposedChanges: {
        summary: String(pc.summary ?? ''),
        steps: Array.isArray(pc.steps) ? pc.steps.map(String) : [],
        documentsToUpdate: Array.isArray(pc.documentsToUpdate) ? pc.documentsToUpdate.map(String) : [],
        technicalChanges: String(pc.technicalChanges ?? ''),
        acceptanceCriteria: Array.isArray(pc.acceptanceCriteria) ? pc.acceptanceCriteria.map(String) : [],
      },
      estimatedEffort: String(parsed.estimatedEffort ?? ''),
      provenance: this.provenance(model),
    }
  }

  async analyzeRegulatoryDelta(
    changeSummary: string,
    sourceShortCode: string,
    existingRequirements: Array<{ id: string; articleRef: string; title: string; description: string }>,
    internalDocuments: Array<{ id: string; title: string; type: string; content: string | null }>
  ): Promise<RegulatoryDeltaAnalysis> {
    const model = MODEL_REASONING
    const system = `You are a regulatory change analyst at a European financial institution. Given a summary of regulatory amendments and existing internal documentation, identify which existing requirements are impacted and what new compliance gaps arise. Be specific about what needs to change. Return valid JSON.`
    const docExcerpts = internalDocuments.map(d => ({
      id: d.id,
      title: d.title,
      type: d.type,
      contentExcerpt: d.content ? d.content.slice(0, 1500) : null,
    }))
    const user = `Regulation: ${sourceShortCode}\n\nChange summary:\n${changeSummary}\n\nExisting requirements (use these exact IDs in your response):\n${JSON.stringify(existingRequirements, null, 2)}\n\nInternal documents:\n${JSON.stringify(docExcerpts, null, 2)}\n\nReturn a JSON object with exactly these keys:\n- impactedRequirementIds: array of requirement IDs from the provided list that are affected by the amendment\n- newGaps: array of objects, each with: requirementId (from the provided list), title (string), description (string), severity ("CRITICAL"|"HIGH"|"MEDIUM"|"LOW"), gap_type ("CONFIGURATION"|"DOCUMENTATION"|"PROCESS"|"GOVERNANCE"|"APPROVAL"), aiAnalysis (string)\n- summary: string summarising the overall impact\n\nReturn only the JSON object.`
    const parsed = await this.chat(model, system, user)
    const rawGaps = Array.isArray(parsed.newGaps) ? parsed.newGaps as Array<Record<string, unknown>> : []
    return {
      impactedRequirementIds: Array.isArray(parsed.impactedRequirementIds) ? parsed.impactedRequirementIds.map(String) : [],
      newGaps: rawGaps.map(g => ({
        requirementId: String(g.requirementId ?? ''),
        title: String(g.title ?? ''),
        description: String(g.description ?? ''),
        severity: (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(String(g.severity)) ? String(g.severity) : 'MEDIUM') as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
        gap_type: (['CONFIGURATION', 'DOCUMENTATION', 'PROCESS', 'GOVERNANCE', 'APPROVAL'].includes(String(g.gap_type)) ? String(g.gap_type) : 'PROCESS') as 'CONFIGURATION' | 'DOCUMENTATION' | 'PROCESS' | 'GOVERNANCE' | 'APPROVAL',
        aiAnalysis: String(g.aiAnalysis ?? ''),
      })),
      summary: String(parsed.summary ?? ''),
      provenance: this.provenance(model),
    }
  }

  async suggestRemediationSteps(
    caseData: { title: string; description: string | null; status: string; priority: string },
    productData: { name: string; type: string; criticality: string },
    requirementData: { articleRef: string; title: string; description: string; obligationType: string },
    regulationShortCode: string
  ): Promise<RemediationSuggestionResult> {
    const model = MODEL_CODE
    const system = `You are a compliance remediation expert. Given a remediation case, product context, and regulatory requirement, produce a concrete step-by-step action plan in JSON.`
    const user = `Remediation case:\n- title: ${caseData.title}\n- description: ${caseData.description ?? 'N/A'}\n- status: ${caseData.status}\n- priority: ${caseData.priority}\n\nProduct:\n- name: ${productData.name}\n- type: ${productData.type}\n- criticality: ${productData.criticality}\n\nRegulation: ${regulationShortCode}\nRequirement:\n- articleRef: ${requirementData.articleRef}\n- title: ${requirementData.title}\n- description: ${requirementData.description}\n- obligationType: ${requirementData.obligationType}\n\nReturn a JSON object with exactly these keys:\n- steps: array of objects, each with: step (number, 1-based), action (string), owner (string, a role), effort (string, e.g. "2 days"), description (string)\n- timelineWeeks: number (total estimated weeks)\n- blockers: array of strings (known blockers or dependencies, may be empty)\n- summary: string (1-2 sentence executive summary)\n\nReturn only the JSON object.`
    const parsed = await this.chat(model, system, user)
    const rawSteps = Array.isArray(parsed.steps) ? parsed.steps as Array<Record<string, unknown>> : []
    return {
      steps: rawSteps.map((s, i) => ({
        step: typeof s.step === 'number' ? s.step : i + 1,
        action: String(s.action ?? ''),
        owner: String(s.owner ?? ''),
        effort: String(s.effort ?? ''),
        description: String(s.description ?? ''),
      })),
      timelineWeeks: typeof parsed.timelineWeeks === 'number' ? parsed.timelineWeeks : 4,
      blockers: Array.isArray(parsed.blockers) ? parsed.blockers.map(String) : [],
      summary: String(parsed.summary ?? ''),
      provenance: this.provenance(model),
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _provider: AiProvider | null = null

export function getAiProvider(): AiProvider {
  if (_provider) return _provider

  const openAiKey = process.env.OPENAI_API_KEY
  if (openAiKey) {
    console.log(`[AI] Using OpenAI provider — ${MODEL_REASONING} / ${MODEL_CODE} / ${MODEL_WRITING}`)
    _provider = new OpenAiProvider(openAiKey)
  } else {
    console.warn('[AI] OPENAI_API_KEY not set — AI calls will fail. Add key to .env.local.')
    _provider = new NoAiProvider()
  }

  return _provider
}
