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
