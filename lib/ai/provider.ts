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

// ─── Static content constants ─────────────────────────────────────────────────

const GUIDELINE_V33_CONTENT = `BR Guideline v3.3 — Backup & Restore

Section 1 — Purpose
This guideline establishes minimum requirements for backup and restore procedures for in-scope IT systems, updated to reflect DORA Article 12 obligations effective January 2025.

Section 2 — Scope
All systems classified as High or Critical by the IT Asset Register are in scope.

Section 3 — Roles & Responsibilities
3.1 Platform Engineering Lead — responsible for technical implementation
3.2 IT Risk & Compliance — responsible for verification and reporting
3.3 CISO — responsible for approving exceptions to geographic redundancy requirements

Section 4 — Backup Configuration
4.1 General Requirements
All in-scope systems must have an automated backup solution configured and tested.

4.2 Backup Configuration (unchanged from v3.2)
Systems classified as High or Critical must have automated daily backup jobs configured.
Backup retention shall be minimum 30 days for operational data.

4.3 Geographic Redundancy (GRZ) [NEW in v3.3]
Backup data for in-scope systems must be stored using geographic redundancy (GRZ) or an approved equivalent.
Implementation: Azure Recovery Services Vault must be configured with storage_mode_type = GeoRedundant.
Restoration capability and evidence of successful restore tests must be documented quarterly.
Exceptions require documented risk acceptance approved by the CISO, reviewed annually.

Section 5 — Testing & Verification
5.1 Restore tests shall be conducted quarterly (increased from annual) and results documented.
5.2 Test results shall be reported to IT Risk & Compliance.
5.3 Policy compliance shall be verified continuously via automated policy evaluation (Control BR0039-GR).

Appendix A — Definitions
Backup: A copy of data taken at a point in time for the purpose of recovery.
Retention: The period for which backup data is retained before deletion.
GRZ: Geo-Redundant Storage — data replicated to a secondary Azure region at least 400 km from the primary.`

const TF_DIFF = `# Recovery Services Vault — Geographic Redundancy (GRZ)
# Control: BR0039-GR [DEMO DATA] | Source: DORA Article 12 §2, BR Guideline v3.3 Section 4.3

resource "azurerm_recovery_services_vault" "app_x_vault" {
  name                = "rsv-app-x-001-prod"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "Standard"
  storage_mode_type   = "GeoRedundant"  # GRZ — satisfies BR0039-GR [DEMO DATA]

  tags = {
    app_id     = "APP-X-001"
    control_id = "BR0039-GR"
    env        = "production"
    managed_by = "aoc-control-line"
  }
}

resource "azurerm_backup_policy_vm" "daily_policy" {
  name                = "bkp-policy-app-x-001-daily"
  resource_group_name = azurerm_resource_group.rg.name
  recovery_vault_name = azurerm_recovery_services_vault.app_x_vault.name

  backup {
    frequency = "Daily"
    time      = "02:00"
  }

  retention_daily {
    count = 30
  }
}

resource "azurerm_backup_protected_vm" "app_x_vm" {
  resource_group_name = azurerm_resource_group.rg.name
  recovery_vault_name = azurerm_recovery_services_vault.app_x_vault.name
  source_vm_id        = azurerm_virtual_machine.app_x_vm.id
  backup_policy_id    = azurerm_backup_policy_vm.daily_policy.id
}`

// ─── Deterministic Demo Provider ──────────────────────────────────────────────

class DeterministicDemoProvider implements AiProvider {
  private provenance(): AiProvenance {
    return {
      provider: 'deterministic-demo',
      model: 'template-v1',
      promptVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
    }
  }

  async deriveGuidelineProposal(_regulation: RegulationFixture, _currentGuideline: string): Promise<GuidelineProposal> {
    return {
      proposedVersion: '3.3',
      proposedContent: GUIDELINE_V33_CONTENT,
      changeSummary: 'Added Section 4.3 Geographic Redundancy (GRZ) to address DORA Article 12 §2 requirement that backup systems be geographically separate from primary systems. Increased restore test frequency from annual to quarterly.',
      newClauses: [
        'Section 4.3 — Geographic Redundancy (GRZ): Backup data must use GeoRedundant storage or approved equivalent',
        'Section 4.3 — Exception process: Risk acceptance from CISO required, reviewed annually',
        'Section 5.1 — Restore test frequency increased from annual to quarterly',
        'Section 5.3 — Continuous automated policy evaluation mandated (Control BR0039-GR)',
      ],
      provenance: this.provenance(),
    }
  }

  async deriveControlActivity(_regulation: RegulationFixture, _guidelineProposal: GuidelineProposal): Promise<ControlActivityProposal> {
    return {
      code: 'BR0039-GR',
      title: 'Backup Geographic Redundancy Verification [DEMO DATA]',
      objective: 'Ensure backup data is stored with geographic redundancy (GRZ) per DORA Article 12, to enable restoration after disruptive events affecting the primary region.',
      implementationStatement: 'Azure Recovery Services Vault is configured with storage_mode_type = GeoRedundant (GRZ) for all High/Critical systems. Automated policy evaluation (POL-BACKUP-001 + POL-BACKUP-002) provides continuous verification. VM backup protection must be active and the vault must report GeoRedundant storage mode.',
      scope: 'All High and Critical systems in Azure OneCloud environment',
      frequency: 'Continuous (automated policy evaluation); Quarterly (restore test documentation)',
      ownerRole: 'Platform Engineering Lead',
      evidenceRequirements: 'Policy evaluation report (POL-BACKUP-001 + POL-BACKUP-002), vault configuration export showing GeoRedundant storage, restore test results (quarterly)',
      automatedTestLogic: 'POL-BACKUP-001 (VM Backup Enabled) AND POL-BACKUP-002 (Backup Storage Geo-Redundant) both return Compliant',
      exceptionLogic: 'Risk acceptance from CISO required; reviewed annually. Exception documented in risk register with mitigating controls.',
      isDemoData: true,
      provenance: this.provenance(),
    }
  }

  async generateIacProposal(appId: string, _appName: string, controlCode: string): Promise<IacProposal> {
    return {
      branchName: `feature/aoc-${controlCode.toLowerCase()}-${appId.toLowerCase()}`,
      commitMessage: `feat(iac): add geo-redundant backup vault for ${appId} — satisfies ${controlCode} [DEMO DATA]\n\nImplements Azure Recovery Services Vault with GeoRedundant storage_mode_type.\nSource: DORA Article 12 §2, BR Guideline v3.3 Section 4.3, Control ${controlCode}.\n\nThis is a simulated IaC change for demonstration purposes.`,
      diffContent: TF_DIFF,
      resources: [
        'azurerm_recovery_services_vault.app_x_vault',
        'azurerm_backup_policy_vm.daily_policy',
        'azurerm_backup_protected_vm.app_x_vm',
      ],
      provenance: this.provenance(),
    }
  }

  async generateDocumentationProposal(_appId: string, deployedConfig: Record<string, unknown>): Promise<DocProposal> {
    const vaultName = deployedConfig.vaultName || 'rsv-app-x-001-prod'
    const sha = deployedConfig.commitSha || 'abc1234'
    const date = deployedConfig.deployedAt || new Date().toISOString().split('T')[0]

    return {
      sddSection: `### Section 5 — Backup & Recovery\n#### Version 2.5 | Updated: ${date}\n\n**5.1 Current State (Post-Remediation)**\nAzure Recovery Services Vault \`${vaultName}\` configured with Geo-Redundant Storage (GRZ).\nDaily backup job at 02:00 UTC, retention 30 days. VM backup protection active.\n\n**5.2 Compliance**\nSatisfies DORA Article 12 §2 geographic separation requirement.\nControl BR0039-GR [DEMO DATA] verified Compliant by automated policy evaluation.\nPOL-BACKUP-001 (VM Backup Enabled): Compliant\nPOL-BACKUP-002 (Backup Storage Geo-Redundant): Compliant\n\n**5.3 Implementation Reference**\nIaC commit: \`${sha}\` | Deployed: ${date} (simulated)\nSource: BR Guideline v3.3 Section 4.3, DORA Article 12\n\n**5.4 Restore Procedure**\n1. Initiate restore via Azure Recovery Services Vault (simulated)\n2. Select recovery point from geo-redundant replica\n3. Validate restore target in secondary region\n4. Document restore test results in quarterly report\n\n*Note: This section describes a simulated deployment. No actual Azure resources were modified.*`,
      omSection: `### Section 3.2 — Data Backup\n#### Version 1.9 | Updated: ${date}\n\n**3.2.1 Backup Schedule**\nDaily backup job runs at 02:00 UTC (automated via Azure Backup policy \`bkp-policy-app-x-001-daily\`).\n\n**3.2.2 Storage Configuration**\nRecovery Services Vault: \`${vaultName}\` (simulated)\nStorage: Geo-Redundant Storage (GRZ) — replicated to secondary Azure region\nRetention: 30 days operational data\n\n**3.2.3 Compliance Status**\nControl BR0039-GR [DEMO DATA]: Active\nDORA Article 12: Compliant (as of ${date})\nDDCR Work Product "Backup Job Configuration": Fulfilled\n\n**3.2.4 Restore Procedure**\n1. Log into Azure Portal (Recovery Services Vault)\n2. Select Application: IT App X (simulated environment)\n3. Choose recovery point (geo-redundant replica available)\n4. Initiate restore to secondary region\n5. Document results in quarterly restore test log\n\n*Note: This section describes a simulated deployment. No actual Azure resources were modified.*`,
      changeRationale: `Documentation updated to reflect simulated deployment of Control BR0039-GR [DEMO DATA] on ${date} (commit ${sha}). Changes address DORA Article 12 §2 geographic separation gap identified in v3.2. Both backup policies now verified Compliant by automated policy evaluation.`,
      provenance: this.provenance(),
    }
  }

  async answerAuditQuestion(_question: string, context: AuditContext): Promise<AuditAnswer> {
    const compliantPct = Math.round((context.portfolioCompliantCount / context.portfolioTotalCount) * 100)
    const nonCompliantCount = context.portfolioTotalCount - context.portfolioCompliantCount

    return {
      directResponse: `GT fulfils data backup requirements associated with ${context.regulation.articleId} through a governed, automated compliance chain: regulatory obligation → approved guideline → approved control activity → Infrastructure-as-Code deployment → automated policy verification → DDCR reporting → documented evidence. As of ${context.deploymentDate} (simulated), IT App X and ${context.portfolioCompliantCount - 1} additional portfolio applications are verified Compliant. ${nonCompliantCount} applications have documented exceptions under review.`,
      sections: [
        {
          heading: '1. Regulatory Requirement',
          content: `**${context.regulation.articleId} — ${context.regulation.title}** (${context.regulation.eurLexUrl})\n\nKey obligations addressed:\n${context.regulation.requirements.map(r => `• ${r}`).join('\n')}`,
        },
        {
          heading: '2. Approved Guideline Clause',
          content: `**BR Guideline v3.3, Section 4.3 — Geographic Redundancy (GRZ)**\n\n"Backup data for in-scope systems must be stored using geographic redundancy (GRZ) or an approved equivalent. Implementation: Azure Recovery Services Vault must be configured with storage_mode_type = GeoRedundant. Exceptions require documented risk acceptance approved by the CISO, reviewed annually."\n\nUpdated from v3.2 to address the DORA Article 12 §2 geographic separation gap.`,
        },
        {
          heading: '3. Control Activity',
          content: `**BR0039-GR — Backup Geographic Redundancy Verification [DEMO DATA]**\n\nObjective: Ensure backup data is stored with geographic redundancy (GRZ) per DORA Article 12.\nImplementation: Azure Recovery Services Vault with GeoRedundant storage_mode_type.\nFrequency: Continuous (automated policy evaluation); Quarterly (restore test documentation).\nOwner Role: Platform Engineering Lead.\nAutomated Test: POL-BACKUP-001 AND POL-BACKUP-002 both Compliant.`,
        },
        {
          heading: '4. Implementation Status — IT App X',
          content: `**Simulated Deployment** | Commit SHA: \`${context.deploymentSha}\` | Date: ${context.deploymentDate}\n\nResources deployed (simulated):\n• \`rsv-app-x-001-prod\` — Recovery Services Vault (GeoRedundant)\n• \`bkp-policy-app-x-001-daily\` — VM Backup Policy (Daily, 30-day retention)\n• Backup Protected VM — vm-app-x-001 enrolled\n\n*Simulated deployment. No actual Azure resources were modified.*`,
        },
        {
          heading: '5. Policy Evidence',
          content: `**POL-BACKUP-001 (VM Backup Enabled):** Compliant\nEvidence: Recovery Services Vault present; BackupProtectedItem active for vm-app-x-001\n\n**POL-BACKUP-002 (Backup Storage Geo-Redundant):** Compliant\nEvidence: Vault configuration shows storageRedundancy = "GeoRedundant"\n\nEvaluated: ${context.deploymentDate} (simulated policy engine)`,
        },
        {
          heading: '6. DDCR Reporting Status',
          content: `**DDCR Work Product: Backup Job Configuration — Fulfilled**\n\nDerived from policy evaluations POL-BACKUP-001 and POL-BACKUP-002 (both Compliant).\nPrevious status: Not Fulfilled (baseline). Updated automatically by DDCR adapter on ${context.deploymentDate}.`,
        },
        {
          heading: '7. Documentation',
          content: `**System Design Document — IT App X**\nVersion ${context.sddVersion} — Section 5.3 updated to reflect simulated GRZ deployment and control BR0039-GR [DEMO DATA]\n\n**Operating Manual — IT App X**\nVersion ${context.omVersion} — Section 3.2 updated with vault configuration, restore procedure, and compliance status`,
        },
        {
          heading: '8. Portfolio Fulfilment',
          content: `**${context.portfolioCompliantCount} of ${context.portfolioTotalCount} applications (${compliantPct}%) are backup-compliant.**\n\n${nonCompliantCount} applications have documented risk acceptances pending remediation:\n${context.exceptions.slice(0, 5).map(e => `• ${e}`).join('\n')}${context.exceptions.length > 5 ? `\n• ...and ${context.exceptions.length - 5} more` : ''}`,
        },
      ],
      evidenceList: [
        { id: 'E001', label: 'DORA Article 12 — EUR-Lex', type: 'RegulationFixture', link: context.regulation.eurLexUrl },
        { id: 'E002', label: 'BR Guideline v3.3 (approved)', type: 'GuidelineVersion' },
        { id: 'E003', label: 'Control BR0039-GR (approved) [DEMO DATA]', type: 'ControlActivity' },
        { id: 'E004', label: `IaC Commit ${context.deploymentSha} (simulated)`, type: 'IacChange' },
        { id: 'E005', label: `Simulated Deployment — ${context.deploymentDate}`, type: 'Deployment' },
        { id: 'E006', label: 'POL-BACKUP-001: Compliant', type: 'PolicyEvaluation' },
        { id: 'E007', label: 'POL-BACKUP-002: Compliant', type: 'PolicyEvaluation' },
        { id: 'E008', label: 'DDCR: Backup Job Configuration — Fulfilled', type: 'ComplianceWorkProduct' },
        { id: 'E009', label: `SDD v${context.sddVersion} (approved)`, type: 'DocumentVersion' },
        { id: 'E010', label: `Operating Manual v${context.omVersion} (approved)`, type: 'DocumentVersion' },
      ],
      disclaimer: 'This answer is generated from synthetic demonstration data. No client data is used. All identifiers (BR0039-GR, APP-X-001, etc.) are fictional. All Azure deployments described are simulated. This demonstrator illustrates the AoC Control Line methodology only.',
      provenance: this.provenance(),
    }
  }
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
   * Call the chat completions endpoint.
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

    const response = await this.client.chat.completions.create(params)
    const raw = response.choices[0]?.message?.content ?? '{}'
    return safeParse(raw)
  }

  private fallback = new DeterministicDemoProvider()

  async deriveGuidelineProposal(regulation: RegulationFixture, currentGuideline: string): Promise<GuidelineProposal> {
    const model = MODEL_REASONING
    try {
      const system = `You are a regulatory compliance expert specialising in EU financial regulation. Given a regulation article and a current internal guideline, propose the minimum update needed to make the guideline compliant. Be precise and conservative — preserve all existing content, only add what is strictly required. Return a valid JSON object with exactly these keys: proposedVersion (string), proposedContent (string, the full updated guideline text), changeSummary (string, 2-3 sentences), newClauses (array of strings, each clause or change bullet).`
      const user = `Regulation:\n${JSON.stringify(regulation, null, 2)}\n\nCurrent Guideline:\n${currentGuideline}\n\nReturn only the JSON object.`
      const parsed = await this.chat(model, system, user)
      return {
        proposedVersion: String(parsed.proposedVersion ?? '3.3'),
        proposedContent: String(parsed.proposedContent ?? ''),
        changeSummary: String(parsed.changeSummary ?? ''),
        newClauses: Array.isArray(parsed.newClauses) ? parsed.newClauses.map(String) : [],
        provenance: this.provenance(model),
      }
    } catch (err) {
      console.warn(`[AI] OpenAI ${model} failed, using deterministic fallback:`, String(err).slice(0, 120))
      return this.fallback.deriveGuidelineProposal(regulation, currentGuideline)
    }
  }

  async deriveControlActivity(regulation: RegulationFixture, guidelineProposal: GuidelineProposal): Promise<ControlActivityProposal> {
    const model = MODEL_REASONING
    try {
      const system = `You are a GRC control designer at a European financial institution. Given a regulation and a proposed guideline update, design a specific, implementable control activity. The control must be verifiable by automated policy evaluation. Use Azure-native tooling where applicable. Return a valid JSON object with exactly these keys: code (string, like BR0039-GR), title (string, must end with "[DEMO DATA]"), objective (string), implementationStatement (string), scope (string), frequency (string), ownerRole (string), evidenceRequirements (string), automatedTestLogic (string), exceptionLogic (string), isDemoData (boolean, always true).`
      const user = `Regulation:\n${JSON.stringify(regulation, null, 2)}\n\nGuideline proposal:\n${JSON.stringify(guidelineProposal, null, 2)}\n\nDesign the control activity. Return only the JSON object.`
      const parsed = await this.chat(model, system, user)
      return {
        code: String(parsed.code ?? 'BR0039-GR'),
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
    } catch (err) {
      console.warn(`[AI] OpenAI ${model} failed, using deterministic fallback:`, String(err).slice(0, 120))
      return this.fallback.deriveControlActivity(regulation, guidelineProposal)
    }
  }

  async generateIacProposal(appId: string, appName: string, controlCode: string): Promise<IacProposal> {
    const model = MODEL_CODE
    try {
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
    } catch (err) {
      console.warn(`[AI] OpenAI ${model} failed, using deterministic fallback:`, String(err).slice(0, 120))
      return this.fallback.generateIacProposal(appId, appName, controlCode)
    }
  }

  async generateDocumentationProposal(appId: string, deployedConfig: Record<string, unknown>): Promise<DocProposal> {
    const model = MODEL_WRITING
    try {
      const system = `You are a technical writer at a financial services firm. Generate documentation updates for an IT system's backup configuration. Return a valid JSON object with exactly these keys: sddSection (string, markdown), omSection (string, markdown), changeRationale (string).`
      const user = `Application: ${appId}\nDeployed config: ${JSON.stringify(deployedConfig, null, 2)}\n\nWrite: (1) SDD Section 5 "Backup & Recovery" covering the geo-redundant vault deployment, DORA Article 12 compliance, and restore procedure; (2) Operating Manual Section 3.2 "Data Backup" with vault name, schedule, GRZ storage note, and restore steps. Include [DEMO DATA] and simulated deployment disclaimers throughout. Return only the JSON object.`
      const parsed = await this.chat(model, system, user)
      return {
        sddSection: String(parsed.sddSection ?? ''),
        omSection: String(parsed.omSection ?? ''),
        changeRationale: String(parsed.changeRationale ?? ''),
        provenance: this.provenance(model),
      }
    } catch (err) {
      console.warn(`[AI] OpenAI ${model} failed, using deterministic fallback:`, String(err).slice(0, 120))
      return this.fallback.generateDocumentationProposal(appId, deployedConfig)
    }
  }

  async answerAuditQuestion(question: string, context: AuditContext): Promise<AuditAnswer> {
    const model = MODEL_REASONING
    // Build deterministic base first, then have o3 enhance it
    const deterministicBase = await new DeterministicDemoProvider().answerAuditQuestion(question, context)

    const system = `You are a senior GRC audit specialist responding to a regulatory audit question. You have been given a pre-structured answer based on verified evidence. Enhance the directResponse to be authoritative and precise. Refine the section content for clarity and completeness. Do NOT invent any facts beyond what is in the context. Preserve all evidence items and the disclaimer verbatim. Return a valid JSON object with exactly these keys: directResponse (string), sections (array of {heading: string, content: string}), evidenceList (array of {id: string, label: string, type: string, link?: string}), disclaimer (string).`
    const user = `Audit question: "${question}"\n\nEvidence context:\n${JSON.stringify(context, null, 2)}\n\nBase answer to enhance:\n${JSON.stringify(deterministicBase, null, 2)}\n\nReturn only the JSON object with the enhanced answer.`

    try {
      const parsed = await this.chat(model, system, user)
      return {
        directResponse: String(parsed.directResponse ?? deterministicBase.directResponse),
        sections: Array.isArray(parsed.sections)
          ? (parsed.sections as Array<{heading?: unknown; content?: unknown}>).map(s => ({ heading: String(s.heading ?? ''), content: String(s.content ?? '') }))
          : deterministicBase.sections,
        evidenceList: Array.isArray(parsed.evidenceList)
          ? (parsed.evidenceList as Array<{id?: unknown; label?: unknown; type?: unknown; link?: unknown}>).map(e => ({
              id: String(e.id ?? ''),
              label: String(e.label ?? ''),
              type: String(e.type ?? ''),
              link: e.link ? String(e.link) : undefined,
            }))
          : deterministicBase.evidenceList,
        disclaimer: String(parsed.disclaimer ?? deterministicBase.disclaimer),
        provenance: this.provenance(model),
      }
    } catch (err) {
      console.error('[AI] o3 audit answer failed, falling back to deterministic:', err)
      return { ...deterministicBase, provenance: this.provenance('deterministic-demo-fallback') }
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let _provider: AiProvider | null = null

export function getAiProvider(): AiProvider {
  if (_provider) return _provider

  const openAiKey = process.env.OPENAI_API_KEY

  if (openAiKey) {
    console.log(`[AI] Using OpenAI provider — ${MODEL_REASONING} (reasoning) / ${MODEL_CODE} (code) / ${MODEL_WRITING} (writing)`)
    _provider = new OpenAiProvider(openAiKey)
  } else {
    console.log('[AI] Using DeterministicDemoProvider (no OPENAI_API_KEY set)')
    _provider = new DeterministicDemoProvider()
  }

  return _provider
}

export { DeterministicDemoProvider }
