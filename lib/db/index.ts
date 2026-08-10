import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import path from 'path'
import fs from 'fs'

const DB_PATH = process.env.DATABASE_URL || './data/aoc.db'
const resolvedPath = path.resolve(process.cwd(), DB_PATH)

// Ensure data directory exists
const dataDir = path.dirname(resolvedPath)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const sqlite = new Database(resolvedPath)

// Performance and reliability settings
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')
sqlite.pragma('synchronous = NORMAL')

// Create all tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS regulation_sources (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL,
    title TEXT NOT NULL,
    source TEXT NOT NULL,
    eur_lex_url TEXT,
    fixture TEXT NOT NULL,
    cached_at TEXT DEFAULT (datetime('now')),
    is_live INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS requirements (
    id TEXT PRIMARY KEY,
    regulation_source_id TEXT NOT NULL,
    text TEXT NOT NULL,
    category TEXT
  );

  CREATE TABLE IF NOT EXISTS guidelines (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    current_version_id TEXT
  );

  CREATE TABLE IF NOT EXISTS guideline_versions (
    id TEXT PRIMARY KEY,
    guideline_id TEXT NOT NULL,
    version TEXT NOT NULL,
    content TEXT NOT NULL,
    proposed_content TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    approval_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS control_activities (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    objective TEXT NOT NULL,
    implementation_statement TEXT,
    scope TEXT,
    frequency TEXT,
    owner_role TEXT,
    evidence_requirements TEXT,
    source_guideline_id TEXT,
    source_requirement_id TEXT,
    automated_test_logic TEXT,
    exception_logic TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    version TEXT NOT NULL DEFAULT '1.0',
    is_demo_data INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    business_service TEXT,
    criticality TEXT NOT NULL,
    environment TEXT,
    owner TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cloud_resources (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    resource_id TEXT,
    config TEXT NOT NULL DEFAULT '{}',
    tags TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS iac_changes (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    control_activity_id TEXT,
    branch_name TEXT NOT NULL,
    commit_sha TEXT,
    pr_number TEXT,
    author TEXT NOT NULL DEFAULT 'aoc-control-line[bot]',
    status TEXT NOT NULL DEFAULT 'draft',
    diff_content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS deployments (
    id TEXT PRIMARY KEY,
    iac_change_id TEXT NOT NULL,
    application_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    simulated_at TEXT,
    cloud_state_snapshot TEXT DEFAULT '{}',
    correlation_id TEXT
  );

  CREATE TABLE IF NOT EXISTS policy_definitions (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    logic TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS policy_evaluations (
    id TEXT PRIMARY KEY,
    policy_definition_id TEXT NOT NULL,
    policy_code TEXT NOT NULL,
    application_id TEXT NOT NULL,
    deployment_id TEXT,
    status TEXT NOT NULL DEFAULT 'NotEvaluated',
    evidence TEXT NOT NULL DEFAULT '{}',
    evaluated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS compliance_work_products (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Not Fulfilled',
    evidence_ids TEXT NOT NULL DEFAULT '[]',
    last_updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS document_versions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    version TEXT NOT NULL,
    content TEXT NOT NULL,
    proposed_content TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    approval_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    config_snapshot TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS evidence_artifacts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    correlation_id TEXT
  );

  CREATE TABLE IF NOT EXISTS evidence_links (
    id TEXT PRIMARY KEY,
    from_artifact_id TEXT NOT NULL,
    to_artifact_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    object_type TEXT NOT NULL,
    object_id TEXT NOT NULL,
    object_version TEXT,
    decision TEXT NOT NULL,
    reviewer_comment TEXT,
    reviewer_name TEXT NOT NULL,
    decided_at TEXT DEFAULT (datetime('now')),
    correlation_id TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    timestamp TEXT DEFAULT (datetime('now')),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    object_type TEXT NOT NULL,
    object_id TEXT,
    object_version TEXT,
    outcome TEXT NOT NULL,
    correlation_id TEXT,
    metadata TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS value_assumptions (
    id TEXT PRIMARY KEY,
    stage INTEGER NOT NULL,
    label TEXT NOT NULL,
    manual_hours REAL NOT NULL,
    assisted_hours REAL NOT NULL,
    unit TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS demo_runs (
    id TEXT PRIMARY KEY,
    current_state TEXT NOT NULL DEFAULT 'BASELINE',
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    correlation_id TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS portfolio_apps (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL,
    name TEXT NOT NULL,
    criticality TEXT NOT NULL,
    backup_compliant INTEGER NOT NULL DEFAULT 0,
    geo_redundant INTEGER NOT NULL DEFAULT 0,
    last_evaluated_at TEXT DEFAULT (datetime('now')),
    exceptions TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS guided_runs (
    id TEXT PRIMARY KEY,
    state TEXT NOT NULL DEFAULT 'idle',
    current_step INTEGER NOT NULL DEFAULT 0,
    current_action TEXT NOT NULL DEFAULT '',
    paused_at_approval INTEGER NOT NULL DEFAULT 0,
    approval_type TEXT,
    started_at TEXT DEFAULT (datetime('now')),
    last_updated_at TEXT DEFAULT (datetime('now')),
    completed_steps TEXT NOT NULL DEFAULT '[]',
    failed_step INTEGER,
    failure_message TEXT,
    correlation_id TEXT NOT NULL DEFAULT ''
  );

  -- ── Multi-Regulation Domain Model ──────────────────────────────────────────

  CREATE TABLE IF NOT EXISTS regulatory_sources (
    id TEXT PRIMARY KEY,
    short_code TEXT NOT NULL,
    name TEXT NOT NULL,
    jurisdiction TEXT NOT NULL DEFAULT 'EU',
    status TEXT NOT NULL DEFAULT 'active',
    effective_date TEXT,
    description TEXT,
    eur_lex_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS regulatory_versions (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    version TEXT NOT NULL,
    published_at TEXT NOT NULL,
    change_type TEXT NOT NULL DEFAULT 'initial',
    change_summary TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS regulatory_requirements (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    version_id TEXT NOT NULL,
    article_ref TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    obligation_type TEXT NOT NULL,
    obligation_level TEXT NOT NULL DEFAULT 'MANDATORY',
    applicability_scope TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS internal_documents (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    owner TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    version TEXT,
    content TEXT,
    linked_document_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS requirement_document_mappings (
    id TEXT PRIMARY KEY,
    requirement_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    coverage_status TEXT NOT NULL DEFAULT 'NOT_ASSESSED',
    assessed_at TEXT,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS compliance_gaps (
    id TEXT PRIMARY KEY,
    requirement_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL,
    gap_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    detected_at TEXT NOT NULL,
    affected_document_ids TEXT DEFAULT '[]',
    ai_analysis TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS control_changes (
    id TEXT PRIMARY KEY,
    gap_id TEXT NOT NULL,
    requirement_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    change_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    proposed_at TEXT,
    approved_at TEXT,
    approved_by TEXT,
    published_at TEXT,
    proposed_changes TEXT,
    ai_generated INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'IT_APPLICATION',
    criticality TEXT NOT NULL,
    hosting_model TEXT,
    legal_entity TEXT,
    owner TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    application_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS product_applicability (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    requirement_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    applicable INTEGER NOT NULL,
    applicability_reason TEXT,
    assessed_at TEXT NOT NULL,
    assessed_by TEXT
  );

  CREATE TABLE IF NOT EXISTS product_gaps (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    requirement_id TEXT NOT NULL,
    control_change_id TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    gap_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    detected_at TEXT NOT NULL,
    resolved_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS work_product_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    required_for_obligation_types TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS product_work_products (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    definition_id TEXT NOT NULL,
    requirement_id TEXT,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'NOT_STARTED',
    content TEXT,
    document_id TEXT,
    approval_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS verification_criteria (
    id TEXT PRIMARY KEY,
    requirement_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    verifier_type TEXT NOT NULL,
    is_mandatory INTEGER NOT NULL DEFAULT 1,
    expected_value TEXT,
    policy_code TEXT
  );

  CREATE TABLE IF NOT EXISTS remediation_cases (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    requirement_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN',
    priority TEXT NOT NULL DEFAULT 'MEDIUM',
    assigned_to TEXT,
    due_date TEXT,
    product_gap_ids TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT,
    resolution_notes TEXT
  );

  CREATE TABLE IF NOT EXISTS verification_results (
    id TEXT PRIMARY KEY,
    criterion_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    requirement_id TEXT NOT NULL,
    remediation_case_id TEXT,
    status TEXT NOT NULL DEFAULT 'NOT_RUN',
    observed_value TEXT,
    evidence_reference TEXT,
    verified_at TEXT NOT NULL,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS evidence_packages (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    requirement_id TEXT NOT NULL,
    remediation_case_id TEXT,
    status TEXT NOT NULL DEFAULT 'ASSEMBLING',
    verification_result_ids TEXT DEFAULT '[]',
    evidence_artifact_ids TEXT DEFAULT '[]',
    assembled_at TEXT,
    approved_at TEXT,
    approved_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS requirement_status_history (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    requirement_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    status TEXT NOT NULL,
    previous_status TEXT,
    reason TEXT,
    control_change_id TEXT,
    remediation_case_id TEXT,
    evidence_package_id TEXT,
    transitioned_at TEXT NOT NULL,
    transitioned_by TEXT,
    correlation_id TEXT
  );

  CREATE TABLE IF NOT EXISTS ddcr_reporting_records (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    requirement_id TEXT,
    source_id TEXT,
    status TEXT NOT NULL,
    effective_at TEXT NOT NULL,
    evidence_package_id TEXT,
    reported_at TEXT NOT NULL,
    reported_by TEXT,
    notes TEXT
  );

  -- ── DDCR Federated Cockpit ─────────────────────────────────────────────────

  CREATE TABLE IF NOT EXISTS ddcr_items (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    tower TEXT NOT NULL,
    org_unit TEXT,
    section TEXT,
    program TEXT,
    responsible_role TEXT NOT NULL,
    action_owner TEXT,
    regulatory_framework TEXT NOT NULL,
    requirement_ref TEXT NOT NULL,
    requirement_title TEXT,
    applicability_status TEXT NOT NULL DEFAULT 'APPLICABLE',
    applicability_rationale TEXT,
    execution_status TEXT NOT NULL DEFAULT 'ACTION_REQUIRED',
    verification_status TEXT NOT NULL DEFAULT 'NOT_STARTED',
    reporting_status TEXT NOT NULL DEFAULT 'NON_COMPLIANT',
    next_action TEXT,
    practical_guidance TEXT,
    due_date TEXT,
    source_system TEXT NOT NULL,
    source_system_url TEXT,
    source_system_ref TEXT,
    evidence_references TEXT DEFAULT '[]',
    last_updated TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ddcr_item_history (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    changed_at TEXT NOT NULL,
    changed_by TEXT,
    source_system TEXT,
    previous_reporting_status TEXT,
    new_reporting_status TEXT,
    previous_execution_status TEXT,
    new_execution_status TEXT,
    change_reason TEXT
  );
`)

export const db = drizzle(sqlite, { schema })
export { sqlite }
export type Db = typeof db
