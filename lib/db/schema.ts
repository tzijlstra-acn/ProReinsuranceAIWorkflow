import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const regulationSources = sqliteTable('regulation_sources', {
  id: text('id').primaryKey(),
  articleId: text('article_id').notNull(),
  title: text('title').notNull(),
  source: text('source').notNull(),
  eurLexUrl: text('eur_lex_url'),
  fixture: text('fixture').notNull(), // JSON string
  cachedAt: text('cached_at').default(sql`(datetime('now'))`),
  isLive: integer('is_live', { mode: 'boolean' }).default(false),
})

export const requirements = sqliteTable('requirements', {
  id: text('id').primaryKey(),
  regulationSourceId: text('regulation_source_id').notNull(),
  text: text('text').notNull(),
  category: text('category'),
})

export const guidelines = sqliteTable('guidelines', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  currentVersionId: text('current_version_id'),
})

export const guidelineVersions = sqliteTable('guideline_versions', {
  id: text('id').primaryKey(),
  guidelineId: text('guideline_id').notNull(),
  version: text('version').notNull(),
  content: text('content').notNull(),
  proposedContent: text('proposed_content'),
  status: text('status').notNull().default('active'), // active | proposed | approved | rejected
  approvalId: text('approval_id'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

export const controlActivities = sqliteTable('control_activities', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  title: text('title').notNull(),
  objective: text('objective').notNull(),
  implementationStatement: text('implementation_statement'),
  scope: text('scope'),
  frequency: text('frequency'),
  ownerRole: text('owner_role'),
  evidenceRequirements: text('evidence_requirements'),
  sourceGuidelineId: text('source_guideline_id'),
  sourceRequirementId: text('source_requirement_id'),
  automatedTestLogic: text('automated_test_logic'),
  exceptionLogic: text('exception_logic'),
  status: text('status').notNull().default('active'), // active | proposed | approved | rejected
  version: text('version').notNull().default('1.0'),
  isDemoData: integer('is_demo_data', { mode: 'boolean' }).default(false),
})

export const applications = sqliteTable('applications', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  businessService: text('business_service'),
  criticality: text('criticality').notNull(), // High | Medium | Low | Critical
  environment: text('environment'),
  owner: text('owner'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

export const cloudResources = sqliteTable('cloud_resources', {
  id: text('id').primaryKey(),
  applicationId: text('application_id').notNull(),
  type: text('type').notNull(), // VM | Storage | RecoveryVault | BackupProtectedItem | BackupPolicy
  name: text('name').notNull(),
  resourceId: text('resource_id'),
  config: text('config').notNull().default('{}'), // JSON
  tags: text('tags').notNull().default('{}'), // JSON
})

export const iacChanges = sqliteTable('iac_changes', {
  id: text('id').primaryKey(),
  applicationId: text('application_id').notNull(),
  controlActivityId: text('control_activity_id'),
  branchName: text('branch_name').notNull(),
  commitSha: text('commit_sha'),
  prNumber: text('pr_number'),
  author: text('author').notNull().default('aoc-control-line[bot]'),
  status: text('status').notNull().default('draft'), // draft | open | approved | merged | rejected
  diffContent: text('diff_content').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

export const deployments = sqliteTable('deployments', {
  id: text('id').primaryKey(),
  iacChangeId: text('iac_change_id').notNull(),
  applicationId: text('application_id').notNull(),
  status: text('status').notNull().default('pending'), // pending | running | succeeded | failed
  simulatedAt: text('simulated_at'),
  cloudStateSnapshot: text('cloud_state_snapshot').default('{}'), // JSON
  correlationId: text('correlation_id'),
})

export const policyDefinitions = sqliteTable('policy_definitions', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  logic: text('logic').notNull(),
})

export const policyEvaluations = sqliteTable('policy_evaluations', {
  id: text('id').primaryKey(),
  policyDefinitionId: text('policy_definition_id').notNull(),
  policyCode: text('policy_code').notNull(),
  applicationId: text('application_id').notNull(),
  deploymentId: text('deployment_id'),
  status: text('status').notNull().default('NotEvaluated'), // Compliant | NonCompliant | NotEvaluated
  evidence: text('evidence').notNull().default('{}'), // JSON
  evaluatedAt: text('evaluated_at').default(sql`(datetime('now'))`),
})

export const complianceWorkProducts = sqliteTable('compliance_work_products', {
  id: text('id').primaryKey(),
  applicationId: text('application_id').notNull(),
  name: text('name').notNull(),
  status: text('status').notNull().default('Not Fulfilled'), // Fulfilled | Not Fulfilled | N/A
  evidenceIds: text('evidence_ids').notNull().default('[]'), // JSON array
  lastUpdatedAt: text('last_updated_at').default(sql`(datetime('now'))`),
})

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  applicationId: text('application_id').notNull(),
  type: text('type').notNull(), // SDD | OperatingManual | Policy | Other
  title: text('title').notNull(),
})

export const documentVersions = sqliteTable('document_versions', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull(),
  version: text('version').notNull(),
  content: text('content').notNull(),
  proposedContent: text('proposed_content'),
  status: text('status').notNull().default('active'), // active | proposed | approved | rejected
  approvalId: text('approval_id'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  configSnapshot: text('config_snapshot').default('{}'), // JSON
})

export const evidenceArtifacts = sqliteTable('evidence_artifacts', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // RegulationFixture | GuidelineVersion | ControlActivity | IacChange | Deployment | PolicyEvaluation | ComplianceWorkProduct | DocumentVersion | AuditEvent
  sourceId: text('source_id').notNull(),
  sourceType: text('source_type').notNull(),
  content: text('content').notNull().default('{}'), // JSON
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  correlationId: text('correlation_id'),
})

export const evidenceLinks = sqliteTable('evidence_links', {
  id: text('id').primaryKey(),
  fromArtifactId: text('from_artifact_id').notNull(),
  toArtifactId: text('to_artifact_id').notNull(),
  relationshipType: text('relationship_type').notNull(), // satisfies | implements | verifies | reports | documents | proves
})

export const approvals = sqliteTable('approvals', {
  id: text('id').primaryKey(),
  objectType: text('object_type').notNull(),
  objectId: text('object_id').notNull(),
  objectVersion: text('object_version'),
  decision: text('decision').notNull(), // approved | rejected
  reviewerComment: text('reviewer_comment'),
  reviewerName: text('reviewer_name').notNull(),
  decidedAt: text('decided_at').default(sql`(datetime('now'))`),
  correlationId: text('correlation_id'),
})

export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').default(sql`(datetime('now'))`),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  objectType: text('object_type').notNull(),
  objectId: text('object_id'),
  objectVersion: text('object_version'),
  outcome: text('outcome').notNull(), // success | failure | pending
  correlationId: text('correlation_id'),
  metadata: text('metadata').default('{}'), // JSON
})

export const valueAssumptions = sqliteTable('value_assumptions', {
  id: text('id').primaryKey(),
  stage: integer('stage').notNull(),
  label: text('label').notNull(),
  manualHours: real('manual_hours').notNull(),
  assistedHours: real('assisted_hours').notNull(),
  unit: text('unit').notNull(),
})

export const demoRuns = sqliteTable('demo_runs', {
  id: text('id').primaryKey(),
  currentState: text('current_state').notNull().default('BASELINE'),
  startedAt: text('started_at').default(sql`(datetime('now'))`),
  completedAt: text('completed_at'),
  correlationId: text('correlation_id').notNull(),
})

export const portfolioApps = sqliteTable('portfolio_apps', {
  id: text('id').primaryKey(),
  appId: text('app_id').notNull(),
  name: text('name').notNull(),
  criticality: text('criticality').notNull(),
  backupCompliant: integer('backup_compliant', { mode: 'boolean' }).notNull().default(false),
  geoRedundant: integer('geo_redundant', { mode: 'boolean' }).notNull().default(false),
  lastEvaluatedAt: text('last_evaluated_at').default(sql`(datetime('now'))`),
  exceptions: text('exceptions').default('[]'), // JSON array
})

export const guidedRuns = sqliteTable('guided_runs', {
  id: text('id').primaryKey(),
  state: text('state').notNull().default('idle'),
  currentStep: integer('current_step').notNull().default(0),
  currentAction: text('current_action').notNull().default(''),
  pausedAtApproval: integer('paused_at_approval', { mode: 'boolean' }).notNull().default(false),
  approvalType: text('approval_type'), // 'standard' | 'iac' | 'docs' | null
  startedAt: text('started_at').default(sql`(datetime('now'))`),
  lastUpdatedAt: text('last_updated_at').default(sql`(datetime('now'))`),
  completedSteps: text('completed_steps').notNull().default('[]'), // JSON array of step numbers
  failedStep: integer('failed_step'),
  failureMessage: text('failure_message'),
  correlationId: text('correlation_id').notNull().default(''),
})

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Regulation Domain Model (PR 1 — generic traceability foundation)
// ─────────────────────────────────────────────────────────────────────────────

// Generalised regulation catalogue (separate from legacy regulation_sources)
export const regulatorySources = sqliteTable('regulatory_sources', {
  id: text('id').primaryKey(), // e.g. 'REG-DORA'
  shortCode: text('short_code').notNull(), // 'DORA' | 'NIS2' | 'GDPR' | 'EU_AI_ACT'
  name: text('name').notNull(),
  jurisdiction: text('jurisdiction').notNull().default('EU'),
  status: text('status').notNull().default('active'), // 'active' | 'superseded' | 'draft'
  effectiveDate: text('effective_date'),
  description: text('description'),
  eurLexUrl: text('eur_lex_url'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

// Point-in-time snapshots of a regulation
export const regulatoryVersions = sqliteTable('regulatory_versions', {
  id: text('id').primaryKey(), // e.g. 'REGV-DORA-2022'
  sourceId: text('source_id').notNull(), // → regulatory_sources.id
  version: text('version').notNull(),
  publishedAt: text('published_at').notNull(),
  changeType: text('change_type').notNull().default('initial'), // 'initial' | 'amendment' | 'corrigendum'
  changeSummary: text('change_summary'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

// Individual regulatory obligations extracted from a version
export const regulatoryRequirements = sqliteTable('regulatory_requirements', {
  id: text('id').primaryKey(), // e.g. 'DORA-BACKUP-001'
  sourceId: text('source_id').notNull(),
  versionId: text('version_id').notNull(),
  articleRef: text('article_ref').notNull(), // 'Art. 12(1)'
  title: text('title').notNull(),
  description: text('description').notNull(),
  // 'TECHNICAL_CONTROL' | 'PROCESS' | 'DOCUMENTATION' | 'GOVERNANCE' | 'REPORTING'
  obligationType: text('obligation_type').notNull(),
  obligationLevel: text('obligation_level').notNull().default('MANDATORY'), // 'MANDATORY' | 'RECOMMENDED'
  applicabilityScope: text('applicability_scope'), // JSON — criticality levels, hosting models
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

// Internal policies, standards, guidelines and controls that map to requirements
export const internalDocuments = sqliteTable('internal_documents', {
  id: text('id').primaryKey(), // 'IDOC-BACKUP-POLICY'
  // 'POLICY' | 'STANDARD' | 'GUIDELINE' | 'CONTROL' | 'PROCEDURE'
  type: text('type').notNull(),
  title: text('title').notNull(),
  owner: text('owner'),
  status: text('status').notNull().default('active'),
  version: text('version'),
  content: text('content'),
  linkedDocumentId: text('linked_document_id'), // → documents.id for backward compat
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// Which internal documents address which regulatory requirements
export const requirementDocumentMappings = sqliteTable('requirement_document_mappings', {
  id: text('id').primaryKey(),
  requirementId: text('requirement_id').notNull(),
  documentId: text('document_id').notNull(), // → internal_documents.id
  // 'FULL' | 'PARTIAL' | 'NONE' | 'NOT_ASSESSED'
  coverageStatus: text('coverage_status').notNull().default('NOT_ASSESSED'),
  assessedAt: text('assessed_at'),
  notes: text('notes'),
})

// Gaps identified in Compliance Hub — requirement not covered by internal docs
export const complianceGaps = sqliteTable('compliance_gaps', {
  id: text('id').primaryKey(), // 'GAP-001'
  requirementId: text('requirement_id').notNull(),
  sourceId: text('source_id').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  severity: text('severity').notNull(), // 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  // 'POLICY_MISSING' | 'CONTROL_INSUFFICIENT' | 'PROCESS_GAP' | 'DOCUMENTATION_GAP'
  gapType: text('gap_type').notNull(),
  // 'OPEN' | 'IN_ANALYSIS' | 'CHANGE_PROPOSED' | 'APPROVED' | 'CLOSED'
  status: text('status').notNull().default('OPEN'),
  detectedAt: text('detected_at').notNull(),
  affectedDocumentIds: text('affected_document_ids').default('[]'), // JSON array
  aiAnalysis: text('ai_analysis'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

// Approved control or policy changes that close a compliance gap
export const controlChanges = sqliteTable('control_changes', {
  id: text('id').primaryKey(), // 'CC-001'
  gapId: text('gap_id').notNull(),
  requirementId: text('requirement_id').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  // 'NEW_CONTROL' | 'AMEND_CONTROL' | 'NEW_POLICY' | 'AMEND_POLICY' | 'PROCESS_CHANGE'
  changeType: text('change_type').notNull(),
  // 'DRAFT' | 'PROPOSED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED'
  status: text('status').notNull().default('DRAFT'),
  proposedAt: text('proposed_at'),
  approvedAt: text('approved_at'),
  approvedBy: text('approved_by'),
  publishedAt: text('published_at'),
  proposedChanges: text('proposed_changes'), // JSON
  aiGenerated: integer('ai_generated', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

// Generalised product catalogue (extends legacy applications)
export const products = sqliteTable('products', {
  id: text('id').primaryKey(), // 'PROD-APP-X'
  name: text('name').notNull(),
  // 'IT_APPLICATION' | 'DATA_PRODUCT' | 'AI_SYSTEM' | 'PROCESS'
  type: text('type').notNull().default('IT_APPLICATION'),
  criticality: text('criticality').notNull(), // 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  // 'AZURE' | 'ON_PREMISE' | 'HYBRID' | 'SAAS'
  hostingModel: text('hosting_model'),
  legalEntity: text('legal_entity'),
  owner: text('owner'),
  description: text('description'),
  status: text('status').notNull().default('active'),
  applicationId: text('application_id'), // → applications.id backward compat link
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

// Whether a regulatory requirement applies to a product
export const productApplicability = sqliteTable('product_applicability', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  requirementId: text('requirement_id').notNull(),
  sourceId: text('source_id').notNull(),
  applicable: integer('applicable', { mode: 'boolean' }).notNull(),
  applicabilityReason: text('applicability_reason'),
  assessedAt: text('assessed_at').notNull(),
  assessedBy: text('assessed_by'),
})

// Product-level gaps: an approved control change is not fulfilled by a product
export const productGaps = sqliteTable('product_gaps', {
  id: text('id').primaryKey(), // 'PG-001'
  productId: text('product_id').notNull(),
  requirementId: text('requirement_id').notNull(),
  controlChangeId: text('control_change_id'),
  title: text('title').notNull(),
  description: text('description').notNull(),
  // 'CONFIGURATION' | 'DOCUMENTATION' | 'PROCESS' | 'APPROVAL'
  gapType: text('gap_type').notNull(),
  severity: text('severity').notNull(),
  // 'OPEN' | 'IN_REMEDIATION' | 'RESOLVED' | 'EXCEPTION'
  status: text('status').notNull().default('OPEN'),
  detectedAt: text('detected_at').notNull(),
  resolvedAt: text('resolved_at'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

// Templates defining what work products a product must produce
export const workProductDefinitions = sqliteTable('work_product_definitions', {
  id: text('id').primaryKey(), // 'WPD-SDD'
  name: text('name').notNull(),
  // 'DOCUMENT' | 'CONFIGURATION' | 'PROCESS' | 'APPROVAL' | 'REPOSITORY_ARTIFACT'
  type: text('type').notNull(),
  description: text('description'),
  requiredForObligationTypes: text('required_for_obligation_types').default('[]'), // JSON array
})

// Actual work products for a specific product against a requirement
export const productWorkProducts = sqliteTable('product_work_products', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  definitionId: text('definition_id').notNull(),
  requirementId: text('requirement_id'),
  title: text('title').notNull(),
  // 'NOT_STARTED' | 'IN_PROGRESS' | 'PROPOSED' | 'APPROVED' | 'FULFILLED' | 'NOT_FULFILLED'
  status: text('status').notNull().default('NOT_STARTED'),
  content: text('content'),
  documentId: text('document_id'), // → documents.id if backed by a doc
  approvalId: text('approval_id'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// Checks that must pass for a requirement to be verified
export const verificationCriteria = sqliteTable('verification_criteria', {
  id: text('id').primaryKey(), // 'VC-DORA-BACKUP-TECH-01'
  requirementId: text('requirement_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  // 'TECHNICAL_POLICY' | 'DOCUMENT_APPROVAL' | 'WORKFLOW_EVIDENCE' | 'REPOSITORY_CHECK' | 'MANUAL_ASSESSMENT'
  verifierType: text('verifier_type').notNull(),
  isMandatory: integer('is_mandatory', { mode: 'boolean' }).notNull().default(true),
  expectedValue: text('expected_value'), // JSON
  policyCode: text('policy_code'), // links to policy_definitions for TECHNICAL_POLICY type
})

// Remediation cases bridge product gaps to the full compliance workflow
export const remediationCases = sqliteTable('remediation_cases', {
  id: text('id').primaryKey(), // 'RC-001'
  productId: text('product_id').notNull(),
  requirementId: text('requirement_id').notNull(),
  sourceId: text('source_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  // 'OPEN' | 'IN_PROGRESS' | 'BLOCKED' | 'RESOLVED' | 'CLOSED'
  status: text('status').notNull().default('OPEN'),
  // 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  priority: text('priority').notNull().default('MEDIUM'),
  assignedTo: text('assigned_to'),
  dueDate: text('due_date'),
  productGapIds: text('product_gap_ids').default('[]'), // JSON array of product_gap.id
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  resolvedAt: text('resolved_at'),
  resolutionNotes: text('resolution_notes'),
})

// Outcome of running a verification check for a product
export const verificationResults = sqliteTable('verification_results', {
  id: text('id').primaryKey(),
  criterionId: text('criterion_id').notNull(),
  productId: text('product_id').notNull(),
  requirementId: text('requirement_id').notNull(),
  remediationCaseId: text('remediation_case_id'),
  // 'PASSED' | 'FAILED' | 'INCONCLUSIVE' | 'NOT_RUN'
  status: text('status').notNull().default('NOT_RUN'),
  observedValue: text('observed_value'), // JSON
  evidenceReference: text('evidence_reference'),
  verifiedAt: text('verified_at').notNull(),
  notes: text('notes'),
})

// Assembled evidence gating the DDCR compliance transition
export const evidencePackages = sqliteTable('evidence_packages', {
  id: text('id').primaryKey(), // 'EP-001'
  productId: text('product_id').notNull(),
  requirementId: text('requirement_id').notNull(),
  remediationCaseId: text('remediation_case_id'),
  // 'ASSEMBLING' | 'COMPLETE' | 'REJECTED'
  status: text('status').notNull().default('ASSEMBLING'),
  verificationResultIds: text('verification_result_ids').default('[]'), // JSON array
  evidenceArtifactIds: text('evidence_artifact_ids').default('[]'), // JSON array
  assembledAt: text('assembled_at'),
  approvedAt: text('approved_at'),
  approvedBy: text('approved_by'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

// Full audit trail of every requirement status transition per product
export const requirementStatusHistory = sqliteTable('requirement_status_history', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  requirementId: text('requirement_id').notNull(),
  sourceId: text('source_id').notNull(),
  // 'NOT_ASSESSED' | 'NOT_APPLICABLE' | 'NON_COMPLIANT' | 'IN_REMEDIATION'
  // | 'VERIFICATION_IN_PROGRESS' | 'VERIFIED' | 'EVIDENCE_COMPLETE' | 'COMPLIANT'
  // | 'EXCEPTION_APPROVED' | 'VERIFICATION_FAILED'
  status: text('status').notNull(),
  previousStatus: text('previous_status'),
  reason: text('reason'),
  controlChangeId: text('control_change_id'),
  remediationCaseId: text('remediation_case_id'),
  evidencePackageId: text('evidence_package_id'),
  transitionedAt: text('transitioned_at').notNull(),
  transitionedBy: text('transitioned_by'),
  correlationId: text('correlation_id'),
})

// ─────────────────────────────────────────────────────────────────────────────
// DDCR Federated Cockpit — new data model (read-only aggregation from source systems)
// ─────────────────────────────────────────────────────────────────────────────

export const ddcrItems = sqliteTable('ddcr_items', {
  id: text('id').primaryKey(),
  // Entity
  entityType: text('entity_type').notNull(), // 'APPLICATION' | 'PROJECT'
  entityId: text('entity_id').notNull(),
  entityName: text('entity_name').notNull(),
  // Organization
  tower: text('tower').notNull(),
  orgUnit: text('org_unit'),
  section: text('section'),
  program: text('program'),
  // Ownership
  responsibleRole: text('responsible_role').notNull(),
  actionOwner: text('action_owner'),
  // Regulatory
  regulatoryFramework: text('regulatory_framework').notNull(),
  requirementRef: text('requirement_ref').notNull(),
  requirementTitle: text('requirement_title'),
  // Four separate status concepts
  applicabilityStatus: text('applicability_status').notNull().default('APPLICABLE'),
  applicabilityRationale: text('applicability_rationale'),
  executionStatus: text('execution_status').notNull().default('ACTION_REQUIRED'),
  verificationStatus: text('verification_status').notNull().default('NOT_STARTED'),
  reportingStatus: text('reporting_status').notNull().default('NON_COMPLIANT'),
  // Action
  nextAction: text('next_action'),
  practicalGuidance: text('practical_guidance'),
  dueDate: text('due_date'),
  // Source system
  sourceSystem: text('source_system').notNull(),
  sourceSystemUrl: text('source_system_url'),
  sourceSystemRef: text('source_system_ref'),
  // Evidence (JSON array: Array<{id,label,type,url?}>)
  evidenceReferences: text('evidence_references').default('[]'),
  // Timestamps
  lastUpdated: text('last_updated').default(sql`(datetime('now'))`),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

export const ddcrItemHistory = sqliteTable('ddcr_item_history', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull(),
  changedAt: text('changed_at').notNull(),
  changedBy: text('changed_by'),
  sourceSystem: text('source_system'),
  previousReportingStatus: text('previous_reporting_status'),
  newReportingStatus: text('new_reporting_status'),
  previousExecutionStatus: text('previous_execution_status'),
  newExecutionStatus: text('new_execution_status'),
  changeReason: text('change_reason'),
})

// Regulatory intelligence scan history — records of each AI-triggered scan
export const regulatoryScanReports = sqliteTable('regulatory_scan_reports', {
  id: text('id').primaryKey(),
  scannedAt: text('scanned_at').notNull(),
  status: text('status').notNull().default('COMPLETE'), // COMPLETE | PARTIAL | FAILED
  eurLexConnected: integer('eur_lex_connected', { mode: 'boolean' }).notNull().default(false),
  sourcesScanned: integer('sources_scanned').notNull().default(0),
  updatesFound: text('updates_found').notNull().default('[]'), // JSON
  newVersionsCreated: integer('new_versions_created').notNull().default(0),
  newGapsCreated: integer('new_gaps_created').notNull().default(0),
  controlsImpacted: text('controls_impacted').notNull().default('[]'), // JSON
  policiesImpacted: text('policies_impacted').notNull().default('[]'), // JSON
  aiSummary: text('ai_summary'),
  error: text('error'),
})

// Current compliance status for DDCR reporting — requirement and product level
export const ddcrReportingRecords = sqliteTable('ddcr_reporting_records', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  requirementId: text('requirement_id'), // null = product-level aggregate
  sourceId: text('source_id'), // null = cross-regulation aggregate
  // 'COMPLIANT' | 'NON_COMPLIANT' | 'NOT_APPLICABLE' | 'EXCEPTION_APPROVED' | 'PENDING'
  status: text('status').notNull(),
  effectiveAt: text('effective_at').notNull(),
  evidencePackageId: text('evidence_package_id'),
  reportedAt: text('reported_at').notNull(),
  reportedBy: text('reported_by'),
  notes: text('notes'),
})
