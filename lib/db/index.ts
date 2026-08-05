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
`)

export const db = drizzle(sqlite, { schema })
export { sqlite }
export type Db = typeof db
