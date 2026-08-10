import { db, sqlite } from './index'
import { randomUUID } from 'crypto'
import {
  regulationSources,
  requirements,
  guidelines,
  guidelineVersions,
  controlActivities,
  applications,
  cloudResources,
  policyDefinitions,
  policyEvaluations,
  complianceWorkProducts,
  documents,
  documentVersions,
  portfolioApps,
  valueAssumptions,
  demoRuns,
  auditEvents,
  // Multi-regulation domain model
  regulatorySources,
  regulatoryVersions,
  regulatoryRequirements,
  internalDocuments,
  requirementDocumentMappings,
  complianceGaps,
  controlChanges,
  products,
  productApplicability,
  productGaps,
  workProductDefinitions,
  productWorkProducts,
  remediationCases,
  verificationCriteria,
  verificationResults,
  evidencePackages,
  requirementStatusHistory,
  ddcrReportingRecords,
  ddcrItems,
  ddcrItemHistory,
} from './schema'

function seed() {
  console.log('Seeding database...')

  // Clear all tables in dependency order
  sqlite.exec(`
    DELETE FROM evidence_links;
    DELETE FROM evidence_artifacts;
    DELETE FROM policy_evaluations;
    DELETE FROM compliance_work_products;
    DELETE FROM document_versions;
    DELETE FROM documents;
    DELETE FROM deployments;
    DELETE FROM iac_changes;
    DELETE FROM cloud_resources;
    DELETE FROM guideline_versions;
    DELETE FROM guidelines;
    DELETE FROM control_activities;
    DELETE FROM requirements;
    DELETE FROM regulation_sources;
    DELETE FROM applications;
    DELETE FROM portfolio_apps;
    DELETE FROM policy_definitions;
    DELETE FROM approvals;
    DELETE FROM audit_events;
    DELETE FROM value_assumptions;
    DELETE FROM demo_runs;
    DELETE FROM ddcr_reporting_records;
    DELETE FROM requirement_status_history;
    DELETE FROM evidence_packages;
    DELETE FROM verification_results;
    DELETE FROM remediation_cases;
    DELETE FROM verification_criteria;
    DELETE FROM product_work_products;
    DELETE FROM work_product_definitions;
    DELETE FROM product_gaps;
    DELETE FROM product_applicability;
    DELETE FROM products;
    DELETE FROM control_changes;
    DELETE FROM compliance_gaps;
    DELETE FROM requirement_document_mappings;
    DELETE FROM internal_documents;
    DELETE FROM regulatory_requirements;
    DELETE FROM regulatory_versions;
    DELETE FROM regulatory_sources;
    DELETE FROM ddcr_item_history;
    DELETE FROM ddcr_items;
    DELETE FROM regulatory_scan_reports;
  `)

  // --- REGULATION SOURCE ---
  const doraFixture = {
    id: 'DORA-ART-12',
    articleId: 'Article 12',
    title: 'Backup policies and procedures, restoration and recovery procedures and methods',
    source: 'EUR-Lex',
    eurLexUrl: 'https://eur-lex.europa.eu/eli/reg/2022/2554/oj/eng',
    requirements: [
      'Financial entities shall implement backup policies specifying the frequency based on criticality and nature of data',
      'Financial entities shall ensure backup systems are geographically separate from primary systems to enable restoration after disruptive events',
      'Restoration and recovery procedures shall be tested periodically and results documented',
      'Recovery time and recovery point objectives shall be documented and tested',
    ],
  }

  db.insert(regulationSources).values({
    id: 'DORA-ART-12',
    articleId: 'Article 12',
    title: doraFixture.title,
    source: 'EUR-Lex',
    eurLexUrl: doraFixture.eurLexUrl,
    fixture: JSON.stringify(doraFixture),
    isLive: false,
  }).run()

  // Requirements
  doraFixture.requirements.forEach((req, i) => {
    db.insert(requirements).values({
      id: `DORA-ART-12-REQ-${i + 1}`,
      regulationSourceId: 'DORA-ART-12',
      text: req,
      category: 'Backup & Recovery',
    }).run()
  })

  // --- GUIDELINE ---
  const GUIDELINE_V32_CONTENT = `BR Guideline v3.2 — Backup & Restore

Section 1 — Purpose
This guideline establishes minimum requirements for backup and restore procedures for in-scope IT systems.

Section 2 — Scope
All systems classified as High or Critical by the IT Asset Register are in scope.

Section 3 — Roles & Responsibilities
3.1 Platform Engineering Lead — responsible for technical implementation
3.2 IT Risk & Compliance — responsible for verification and reporting

Section 4 — Backup Configuration
4.1 General Requirements
All in-scope systems must have an automated backup solution configured and tested.

4.2 Backup Configuration
Systems classified as High or Critical must have automated daily backup jobs configured.
Backup retention shall be minimum 30 days for operational data.

Section 5 — Testing & Verification
5.1 Restore tests shall be conducted annually and results documented.
5.2 Test results shall be reported to IT Risk & Compliance.

Appendix A — Definitions
Backup: A copy of data taken at a point in time for the purpose of recovery.
Retention: The period for which backup data is retained before deletion.`

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

  db.insert(guidelines).values({
    id: 'GL-BR-001',
    title: 'BR Guideline — Backup & Restore',
    currentVersionId: 'GLV-BR-001-v32',
  }).run()

  db.insert(guidelineVersions).values({
    id: 'GLV-BR-001-v32',
    guidelineId: 'GL-BR-001',
    version: '3.2',
    content: GUIDELINE_V32_CONTENT,
    proposedContent: null,
    status: 'active',
  }).run()

  db.insert(guidelineVersions).values({
    id: 'GLV-BR-001-v33',
    guidelineId: 'GL-BR-001',
    version: '3.3',
    content: GUIDELINE_V32_CONTENT,
    proposedContent: GUIDELINE_V33_CONTENT,
    status: 'proposed',
  }).run()

  // --- CONTROL ACTIVITIES ---
  db.insert(controlActivities).values({
    id: 'CA-BR0039',
    code: 'BR0039',
    title: 'Backup Job Configuration',
    objective: 'Ensure automated backup jobs are configured for all in-scope systems classified as High or Critical.',
    implementationStatement: 'Platform Engineering Lead configures automated daily backup jobs for all High/Critical systems. Backup retention of minimum 30 days is enforced. Job execution logs are reviewed monthly.',
    scope: 'All High and Critical systems in the IT Asset Register',
    frequency: 'Continuous (job configuration); Monthly (log review)',
    ownerRole: 'Platform Engineering Lead',
    evidenceRequirements: 'Backup job configuration export, execution logs (30 days), restore test results (annual)',
    sourceGuidelineId: 'GL-BR-001',
    sourceRequirementId: 'DORA-ART-12-REQ-1',
    automatedTestLogic: null,
    exceptionLogic: 'Exceptions require documented risk acceptance approved by IT Risk & Compliance Lead',
    status: 'active',
    version: '2.1',
    isDemoData: false,
  }).run()

  db.insert(controlActivities).values({
    id: 'CA-BR0039-GR',
    code: 'BR0039-GR',
    title: 'Backup Geographic Redundancy Verification [DEMO DATA]',
    objective: 'Ensure backup data is stored with geographic redundancy (GRZ) per DORA Article 12, to enable restoration after disruptive events affecting the primary region.',
    implementationStatement: 'Azure Recovery Services Vault is configured with storage_mode_type = GeoRedundant (GRZ) for all High/Critical systems. Automated policy evaluation (POL-BACKUP-001 + POL-BACKUP-002) provides continuous verification. VM backup protection must be active.',
    scope: 'All High and Critical systems in Azure OneCloud environment',
    frequency: 'Continuous (automated policy evaluation); Quarterly (restore test documentation)',
    ownerRole: 'Platform Engineering Lead',
    evidenceRequirements: 'Policy evaluation report (POL-BACKUP-001 + POL-BACKUP-002), vault configuration export showing GeoRedundant storage, restore test results (quarterly)',
    sourceGuidelineId: 'GL-BR-001',
    sourceRequirementId: 'DORA-ART-12-REQ-2',
    automatedTestLogic: 'POL-BACKUP-001 (VM Backup Enabled) AND POL-BACKUP-002 (Backup Storage Geo-Redundant) both return Compliant',
    exceptionLogic: 'Risk acceptance from CISO required; reviewed annually. Exception documented in risk register with mitigating controls.',
    status: 'proposed',
    version: '1.0',
    isDemoData: true,
  }).run()

  // --- APPLICATION: IT App X ---
  db.insert(applications).values({
    id: 'APP-X-001',
    name: 'IT App X',
    businessService: 'Claims Processing',
    criticality: 'High',
    environment: 'Azure OneCloud — simulated',
    owner: 'Claims Processing Platform Team',
  }).run()

  // Cloud resources — BASELINE state (non-compliant)
  db.insert(cloudResources).values({
    id: 'CR-VM-APP-X-001',
    applicationId: 'APP-X-001',
    type: 'VM',
    name: 'vm-app-x-001',
    resourceId: '/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-app-x-prod/providers/Microsoft.Compute/virtualMachines/vm-app-x-001',
    config: JSON.stringify({
      vmSize: 'Standard_D4s_v3',
      osType: 'Windows',
      encryptionEnabled: true,
      diagnosticLogging: false,
      backupProtected: false,
    }),
    tags: JSON.stringify({ app_id: 'APP-X-001', env: 'production', criticality: 'high' }),
  }).run()

  db.insert(cloudResources).values({
    id: 'CR-ST-APP-X-001',
    applicationId: 'APP-X-001',
    type: 'Storage',
    name: 'st-app-x-001',
    resourceId: '/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-app-x-prod/providers/Microsoft.Storage/storageAccounts/stappx001',
    config: JSON.stringify({
      redundancy: 'LocallyRedundant',
      tier: 'Standard',
      kind: 'StorageV2',
    }),
    tags: JSON.stringify({ app_id: 'APP-X-001', env: 'production' }),
  }).run()

  // --- POLICY DEFINITIONS ---
  const policyDefs = [
    {
      id: 'POL-DEF-001',
      code: 'POL-BACKUP-001',
      title: 'VM Backup Enabled',
      description: 'Verifies that a Recovery Services Vault exists and the VM has an active Backup Protected Item configured.',
      logic: 'application has CloudResource with type=RecoveryVault AND associated BackupProtectedItem for VM',
    },
    {
      id: 'POL-DEF-002',
      code: 'POL-BACKUP-002',
      title: 'Backup Storage Geo-Redundant (GRZ)',
      description: 'Verifies that the Recovery Services Vault is configured with GeoRedundant storage (GRZ) per DORA Article 12.',
      logic: 'RecoveryVault CloudResource has config.storageRedundancy = "GeoRedundant"',
    },
    {
      id: 'POL-DEF-003',
      code: 'POL-EDR-001',
      title: 'EDR Agent Installed',
      description: 'Verifies that an Endpoint Detection and Response agent is installed and reporting on the VM. (Contextual — always NonCompliant in demo environment.)',
      logic: 'application has CloudResource with type=EDRAgent AND status=Active',
    },
    {
      id: 'POL-DEF-004',
      code: 'POL-ENC-001',
      title: 'Disk Encryption Enabled',
      description: 'Verifies that disk encryption is enabled for VM resources.',
      logic: 'VM CloudResource has config.encryptionEnabled = true',
    },
    {
      id: 'POL-DEF-005',
      code: 'POL-LOG-001',
      title: 'Diagnostic Logging Enabled',
      description: 'Verifies that diagnostic logging is enabled and routing to a Log Analytics Workspace.',
      logic: 'VM CloudResource has config.diagnosticLogging = true',
    },
  ]

  policyDefs.forEach(p => {
    db.insert(policyDefinitions).values(p).run()
  })

  // Initial policy evaluations — BASELINE (all NonCompliant for backup)
  const evalTime = new Date().toISOString()
  ;[
    { id: 'PE-001-BASELINE', policyCode: 'POL-BACKUP-001', defId: 'POL-DEF-001', status: 'NonCompliant', evidence: { hasVault: false, hasProtectedItem: false, evaluatedAt: evalTime } },
    { id: 'PE-002-BASELINE', policyCode: 'POL-BACKUP-002', defId: 'POL-DEF-002', status: 'NonCompliant', evidence: { vaultExists: false, storageRedundancy: null, evaluatedAt: evalTime } },
    { id: 'PE-003-BASELINE', policyCode: 'POL-EDR-001', defId: 'POL-DEF-003', status: 'NonCompliant', evidence: { hasEDRAgent: false, evaluatedAt: evalTime } },
    { id: 'PE-004-BASELINE', policyCode: 'POL-ENC-001', defId: 'POL-DEF-004', status: 'Compliant', evidence: { encryptionEnabled: true, evaluatedAt: evalTime } },
    { id: 'PE-005-BASELINE', policyCode: 'POL-LOG-001', defId: 'POL-DEF-005', status: 'NonCompliant', evidence: { diagnosticLogging: false, evaluatedAt: evalTime } },
  ].forEach(e => {
    db.insert(policyEvaluations).values({
      id: e.id,
      policyDefinitionId: e.defId,
      policyCode: e.policyCode,
      applicationId: 'APP-X-001',
      deploymentId: null,
      status: e.status,
      evidence: JSON.stringify(e.evidence),
    }).run()
  })

  // DDCR Work Products — BASELINE
  ;[
    { id: 'WP-001', name: 'Backup Job Configuration', status: 'Not Fulfilled' },
    { id: 'WP-002', name: 'Business Continuity Plan', status: 'Fulfilled' },
    { id: 'WP-003', name: 'Disaster Recovery Plan', status: 'Fulfilled' },
    { id: 'WP-004', name: 'Information Security Assessment', status: 'Fulfilled' },
  ].forEach(wp => {
    db.insert(complianceWorkProducts).values({
      id: wp.id,
      applicationId: 'APP-X-001',
      name: wp.name,
      status: wp.status,
      evidenceIds: '[]',
    }).run()
  })

  // Documents
  db.insert(documents).values({ id: 'DOC-SDD-001', applicationId: 'APP-X-001', type: 'SDD', title: 'System Design Document — IT App X' }).run()
  db.insert(documents).values({ id: 'DOC-OM-001', applicationId: 'APP-X-001', type: 'OperatingManual', title: 'Operating Manual — IT App X' }).run()

  db.insert(documentVersions).values({
    id: 'DV-SDD-001-v1',
    documentId: 'DOC-SDD-001',
    version: '2.4',
    content: `# System Design Document — IT App X
## Version 2.4 | Last Reviewed: Q3 2024

### Section 5 — Backup & Recovery

[PLACEHOLDER — to be updated following DORA Article 12 gap remediation]

5.1 Current State
Daily backup job runs at 02:00 UTC. Retention: 30 days.
Storage: Azure Blob Storage, locally redundant.
No geographic replication currently configured.

5.2 Gap Identified
DORA Article 12 requires backup data to be geographically separate from primary systems. Current configuration uses locally redundant storage which does not satisfy this requirement.

5.3 Remediation
Pending implementation of Control BR0039-GR (Backup Geographic Redundancy Verification).

Last reviewed: Q3 2024`,
    status: 'active',
  }).run()

  db.insert(documentVersions).values({
    id: 'DV-OM-001-v1',
    documentId: 'DOC-OM-001',
    version: '1.8',
    content: `# Operating Manual — IT App X
## Version 1.8 | Last Updated: Q3 2024

### Section 3.2 — Data Backup

3.2.1 Backup Schedule
Daily backup job runs at 02:00 UTC (automated).
Job monitoring: Azure Monitor alerts configured for job failures.
On-call: Platform Engineering Lead via PagerDuty rotation.

3.2.2 Storage Configuration
Storage: Azure Blob Storage, locally redundant (LRS).
Retention: 30 days operational data.
No geographic replication currently configured.

3.2.3 Restore Procedure
1. Log into Azure Portal
2. Navigate to Storage Account stappx001
3. Select the blob container and version to restore
4. Use AzCopy to download to recovery location
5. Validate restored data integrity via checksum

3.2.4 Known Gaps
Geographic replication not configured. Risk accepted Q3 2024 pending DORA Article 12 remediation assessment.

Last updated: Q3 2024`,
    status: 'active',
  }).run()

  // --- PORTFOLIO APPS (25 total, including IT App X) ---
  const portfolioAppNames = [
    { name: 'Core Banking Platform', criticality: 'Critical', compliant: true, geoRedundant: true },
    { name: 'Payment Gateway', criticality: 'Critical', compliant: true, geoRedundant: true },
    { name: 'General Ledger System', criticality: 'High', compliant: true, geoRedundant: true },
    { name: 'Customer Portal', criticality: 'High', compliant: false, geoRedundant: false },
    { name: 'Risk Engine', criticality: 'Critical', compliant: true, geoRedundant: true },
    { name: 'Regulatory Reporting Suite', criticality: 'High', compliant: true, geoRedundant: true },
    { name: 'Trade Settlement System', criticality: 'Critical', compliant: true, geoRedundant: true },
    { name: 'Know Your Customer Platform', criticality: 'High', compliant: false, geoRedundant: false },
    { name: 'Anti-Money Laundering Engine', criticality: 'High', compliant: true, geoRedundant: true },
    { name: 'Treasury Management System', criticality: 'Critical', compliant: true, geoRedundant: true },
    { name: 'Loan Origination System', criticality: 'High', compliant: false, geoRedundant: false },
    { name: 'Collateral Management Platform', criticality: 'High', compliant: true, geoRedundant: false },
    { name: 'Market Data Feed', criticality: 'Medium', compliant: false, geoRedundant: false },
    { name: 'Derivatives Pricing Engine', criticality: 'High', compliant: true, geoRedundant: true },
    { name: 'Fraud Detection System', criticality: 'High', compliant: true, geoRedundant: true },
    { name: 'SWIFT Messaging Gateway', criticality: 'Critical', compliant: true, geoRedundant: true },
    { name: 'Securities Custody System', criticality: 'High', compliant: false, geoRedundant: false },
    { name: 'Compliance Monitoring Tool', criticality: 'Medium', compliant: true, geoRedundant: false },
    { name: 'Internal Audit Platform', criticality: 'Medium', compliant: false, geoRedundant: false },
    { name: 'HR Information System', criticality: 'Low', compliant: true, geoRedundant: false },
    { name: 'Document Management System', criticality: 'Medium', compliant: false, geoRedundant: false },
    { name: 'Business Intelligence Suite', criticality: 'Medium', compliant: true, geoRedundant: false },
    { name: 'Claims Processing API', criticality: 'High', compliant: false, geoRedundant: false },
    { name: 'Reinsurance Bordereau System', criticality: 'High', compliant: true, geoRedundant: true },
  ]

  // IT App X itself
  db.insert(portfolioApps).values({
    id: 'PA-APP-X-001',
    appId: 'APP-X-001',
    name: 'IT App X',
    criticality: 'High',
    backupCompliant: false,
    geoRedundant: false,
    exceptions: '[]',
  }).run()

  portfolioAppNames.forEach((app, i) => {
    const appId = `APP-${String(i + 2).padStart(3, '0')}`
    db.insert(portfolioApps).values({
      id: `PA-${appId}`,
      appId,
      name: app.name,
      criticality: app.criticality,
      backupCompliant: app.compliant,
      geoRedundant: app.geoRedundant,
      exceptions: app.compliant ? '[]' : JSON.stringify([{ type: 'risk-acceptance', description: 'Pending remediation — DORA Article 12 gap', raisedDate: '2024-10-01' }]),
    }).run()
  })

  // --- VALUE ASSUMPTIONS ---
  const valueAssumptionData = [
    { id: 'VA-1', stage: 1, label: 'Define Backup Standards & Controls', manualHours: 32, assistedHours: 8, unit: 'per regulatory change' },
    { id: 'VA-2', stage: 2, label: 'Integrate Backup Controls', manualHours: 16, assistedHours: 4, unit: 'per application' },
    { id: 'VA-3', stage: 3, label: 'Verify Backup Control Fulfilment', manualHours: 4, assistedHours: 0.75, unit: 'per application' },
    { id: 'VA-4', stage: 4, label: 'Report Backup Control Fulfilment', manualHours: 2, assistedHours: 0.25, unit: 'per application' },
    { id: 'VA-5', stage: 5, label: 'Document Backup Control Fulfilment', manualHours: 8, assistedHours: 2, unit: 'per application' },
    { id: 'VA-6', stage: 6, label: 'Prove Backup Control Fulfilment', manualHours: 12, assistedHours: 2, unit: 'per audit question' },
  ]

  valueAssumptionData.forEach(va => {
    db.insert(valueAssumptions).values(va).run()
  })

  // --- DEMO RUN ---
  db.insert(demoRuns).values({
    id: 'DEMO-RUN-001',
    currentState: 'BASELINE',
    correlationId: randomUUID(),
  }).run()

  // Initial audit event
  db.insert(auditEvents).values({
    id: randomUUID(),
    actor: 'system',
    action: 'SEED_COMPLETE',
    objectType: 'DemoRun',
    objectId: 'DEMO-RUN-001',
    outcome: 'success',
    correlationId: 'seed',
    metadata: JSON.stringify({ message: 'Database seeded with baseline state' }),
  }).run()

  // ── MULTI-REGULATION DOMAIN MODEL ──────────────────────────────────────────

  const now = new Date().toISOString()

  // ── Regulatory Sources ────────────────────────────────────────────────────
  const regSources = [
    {
      id: 'REG-DORA', shortCode: 'DORA',
      name: 'Digital Operational Resilience Act',
      jurisdiction: 'EU', status: 'active',
      effectiveDate: '2025-01-17',
      description: 'Regulation (EU) 2022/2554 on digital operational resilience for the financial sector.',
      eurLexUrl: 'https://eur-lex.europa.eu/eli/reg/2022/2554/oj/eng',
    },
    {
      id: 'REG-NIS2', shortCode: 'NIS2',
      name: 'Network and Information Security Directive 2',
      jurisdiction: 'EU', status: 'active',
      effectiveDate: '2024-10-18',
      description: 'Directive (EU) 2022/2555 on measures for a high common level of cybersecurity.',
      eurLexUrl: 'https://eur-lex.europa.eu/eli/dir/2022/2555/oj/eng',
    },
    {
      id: 'REG-GDPR', shortCode: 'GDPR',
      name: 'General Data Protection Regulation',
      jurisdiction: 'EU', status: 'active',
      effectiveDate: '2018-05-25',
      description: 'Regulation (EU) 2016/679 on the protection of natural persons with regard to personal data.',
      eurLexUrl: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng',
    },
    {
      id: 'REG-EUAIA', shortCode: 'EU_AI_ACT',
      name: 'EU Artificial Intelligence Act',
      jurisdiction: 'EU', status: 'active',
      effectiveDate: '2026-08-02',
      description: 'Regulation (EU) 2024/1689 laying down harmonised rules on artificial intelligence.',
      eurLexUrl: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng',
    },
  ]
  regSources.forEach(s => db.insert(regulatorySources).values({ ...s, createdAt: now }).run())

  // ── Regulatory Versions ───────────────────────────────────────────────────
  const regVersions = [
    { id: 'REGV-DORA-2022', sourceId: 'REG-DORA', version: '2022/2554', publishedAt: '2022-12-14', changeType: 'initial', isActive: true },
    { id: 'REGV-NIS2-2022', sourceId: 'REG-NIS2', version: '2022/2555', publishedAt: '2022-12-27', changeType: 'initial', isActive: true },
    { id: 'REGV-GDPR-2016', sourceId: 'REG-GDPR', version: '2016/679', publishedAt: '2016-05-04', changeType: 'initial', isActive: true },
    { id: 'REGV-EUAIA-2024', sourceId: 'REG-EUAIA', version: '2024/1689', publishedAt: '2024-07-12', changeType: 'initial', isActive: true },
  ]
  regVersions.forEach(v => db.insert(regulatoryVersions).values({ ...v, createdAt: now }).run())

  // Pending regulatory version — simulates a published amendment awaiting review (is_active = 0)
  db.insert(regulatoryVersions).values({
    id: 'RV-DORA-2025-AMEND',
    sourceId: 'REG-DORA',
    version: '2025/Q1 Amendment',
    publishedAt: '2025-03-15T00:00:00.000Z',
    changeType: 'amendment',
    changeSummary: 'Amendment to DORA Article 12: enhanced requirements for backup testing frequency (monthly → weekly for critical systems) and introduction of mandatory cross-border backup verification for Tier-1 financial entities.',
    isActive: false,
    createdAt: now,
  }).run()

  // ── Regulatory Requirements ───────────────────────────────────────────────
  const regRequirements = [
    {
      id: 'DORA-BACKUP-001',
      sourceId: 'REG-DORA', versionId: 'REGV-DORA-2022',
      articleRef: 'Art. 12(1)(c)',
      title: 'Backup geographic redundancy',
      description: 'Financial entities shall ensure backup systems are geographically separate from primary systems to enable restoration after disruptive events affecting the primary region.',
      obligationType: 'TECHNICAL_CONTROL', obligationLevel: 'MANDATORY',
      applicabilityScope: JSON.stringify({ productCriticality: ['CRITICAL', 'HIGH'], hostingModel: ['AZURE', 'HYBRID'] }),
      status: 'active',
    },
    {
      id: 'NIS2-SECURITY-001',
      sourceId: 'REG-NIS2', versionId: 'REGV-NIS2-2022',
      articleRef: 'Art. 21(2)(b)',
      title: 'Incident handling and security process',
      description: 'Essential entities shall implement policies and procedures on incident handling, including detection, analysis, containment, recovery and post-incident review.',
      obligationType: 'PROCESS', obligationLevel: 'MANDATORY',
      applicabilityScope: JSON.stringify({ productCriticality: ['CRITICAL', 'HIGH', 'MEDIUM'] }),
      status: 'active',
    },
    {
      id: 'GDPR-RECORDS-001',
      sourceId: 'REG-GDPR', versionId: 'REGV-GDPR-2016',
      articleRef: 'Art. 30',
      title: 'Records of processing activities',
      description: 'Each controller shall maintain a record of processing activities under its responsibility containing specified information about processing operations.',
      obligationType: 'DOCUMENTATION', obligationLevel: 'MANDATORY',
      applicabilityScope: JSON.stringify({ processesPersonalData: true }),
      status: 'active',
    },
    {
      id: 'EUAIA-INVENTORY-001',
      sourceId: 'REG-EUAIA', versionId: 'REGV-EUAIA-2024',
      articleRef: 'Art. 49',
      title: 'Registration of high-risk AI systems',
      description: 'Providers and deployers of high-risk AI systems shall register those systems in the EU database before placing them on the market or putting them into service.',
      obligationType: 'GOVERNANCE', obligationLevel: 'MANDATORY',
      applicabilityScope: JSON.stringify({ productType: ['AI_SYSTEM'], aiRiskCategory: ['HIGH'] }),
      status: 'active',
    },
  ]
  regRequirements.forEach(r => db.insert(regulatoryRequirements).values({ ...r, createdAt: now }).run())

  // ── Internal Documents ────────────────────────────────────────────────────
  const internalDocs = [
    { id: 'IDOC-BR-GUIDELINE', type: 'GUIDELINE', title: 'BR Guideline — Backup & Restore', owner: 'Platform Engineering Lead', status: 'active', version: '3.2', linkedDocumentId: null },
    { id: 'IDOC-SEC-POLICY', type: 'POLICY', title: 'Information Security Policy', owner: 'CISO', status: 'active', version: '2.1', linkedDocumentId: null },
    { id: 'IDOC-INC-PROC', type: 'PROCEDURE', title: 'Incident Management Procedure', owner: 'IT Risk & Compliance', status: 'active', version: '1.4', linkedDocumentId: null },
    { id: 'IDOC-DATA-RECORDS', type: 'STANDARD', title: 'Data Processing Records Standard', owner: 'DPO', status: 'active', version: '1.0', linkedDocumentId: null },
    { id: 'IDOC-BR-CONTROL', type: 'CONTROL', title: 'Backup Job Configuration Control (BR0039)', owner: 'Platform Engineering Lead', status: 'active', version: '2.1', linkedDocumentId: null },
  ]
  internalDocs.forEach(d => db.insert(internalDocuments).values({ ...d, createdAt: now, updatedAt: now }).run())

  // ── Requirement → Document coverage mappings ──────────────────────────────
  const rdMappings = [
    { id: 'RDM-001', requirementId: 'DORA-BACKUP-001', documentId: 'IDOC-BR-GUIDELINE', coverageStatus: 'PARTIAL', notes: 'Guideline v3.2 does not address geo-redundancy requirement introduced by DORA Art.12.' },
    { id: 'RDM-002', requirementId: 'DORA-BACKUP-001', documentId: 'IDOC-BR-CONTROL', coverageStatus: 'NONE', notes: 'Control BR0039 covers basic backup job configuration but not geo-redundancy.' },
    { id: 'RDM-003', requirementId: 'NIS2-SECURITY-001', documentId: 'IDOC-SEC-POLICY', coverageStatus: 'PARTIAL', notes: 'Security policy does not include structured post-incident review process.' },
    { id: 'RDM-004', requirementId: 'NIS2-SECURITY-001', documentId: 'IDOC-INC-PROC', coverageStatus: 'PARTIAL', notes: 'Incident procedure lacks formal containment and recovery sections.' },
    { id: 'RDM-005', requirementId: 'GDPR-RECORDS-001', documentId: 'IDOC-DATA-RECORDS', coverageStatus: 'FULL', notes: 'Data processing records standard fully addresses Art. 30 obligations.' },
    { id: 'RDM-006', requirementId: 'EUAIA-INVENTORY-001', documentId: 'IDOC-SEC-POLICY', coverageStatus: 'NONE', notes: 'Not applicable — IT App X is not an AI system.' },
  ]
  rdMappings.forEach(m => db.insert(requirementDocumentMappings).values(m).run())

  // ── Compliance Gaps ───────────────────────────────────────────────────────
  const gaps = [
    {
      id: 'GAP-001', requirementId: 'DORA-BACKUP-001', sourceId: 'REG-DORA',
      title: 'Backup geographic redundancy not addressed in internal controls',
      description: 'DORA Art.12(1)(c) requires geographically separate backup storage. BR Guideline v3.2 and Control BR0039 do not include this requirement. Azure Recovery Services Vault must be configured with GeoRedundant storage (GRZ).',
      severity: 'HIGH', gapType: 'CONTROL_INSUFFICIENT',
      status: 'CHANGE_PROPOSED', detectedAt: '2024-11-15',
      affectedDocumentIds: JSON.stringify(['IDOC-BR-GUIDELINE', 'IDOC-BR-CONTROL']),
      aiAnalysis: 'Gap confirmed: DORA Art.12(1)(c) is not covered by existing controls. Required remediation: (1) Update BR Guideline v3.2 to v3.3 with geo-redundancy requirement. (2) Create new control BR0039-GR for automated policy verification.',
    },
    {
      id: 'GAP-002', requirementId: 'NIS2-SECURITY-001', sourceId: 'REG-NIS2',
      title: 'Incident handling procedure missing structured post-incident review',
      description: 'NIS2 Art.21(2)(b) requires formal post-incident review documentation. Current Incident Management Procedure v1.4 lacks this section. A structured post-incident review template and approval workflow is required.',
      severity: 'MEDIUM', gapType: 'PROCESS_GAP',
      status: 'CHANGE_PROPOSED', detectedAt: '2024-12-03',
      affectedDocumentIds: JSON.stringify(['IDOC-INC-PROC', 'IDOC-SEC-POLICY']),
      aiAnalysis: 'Gap confirmed: NIS2 Art.21(2)(b) post-incident review requirement is not covered. Required remediation: (1) Update Incident Management Procedure to include post-incident review section. (2) Add approval workflow evidence requirement.',
    },
  ]
  gaps.forEach(g => db.insert(complianceGaps).values({ ...g, createdAt: now }).run())

  // ── Control Changes ───────────────────────────────────────────────────────
  const ccChanges = [
    {
      id: 'CC-001', gapId: 'GAP-001', requirementId: 'DORA-BACKUP-001',
      title: 'Introduce Backup Geographic Redundancy Control (BR0039-GR)',
      description: 'Amend BR Guideline to v3.3 adding geo-redundancy requirement. Create new control BR0039-GR requiring Azure Recovery Services Vault configured with GeoRedundant storage. Automated policy verification via POL-BACKUP-002.',
      changeType: 'AMEND_CONTROL',
      status: 'APPROVED',
      proposedAt: '2024-11-20',
      approvedAt: '2024-12-01',
      approvedBy: 'IT Risk & Compliance Lead',
      publishedAt: '2024-12-05',
      proposedChanges: JSON.stringify({
        documentChanges: [{ documentId: 'IDOC-BR-GUIDELINE', changeDescription: 'Add Section 4.3 — Geographic Redundancy requirement' }],
        configurationChanges: [{ description: 'Azure Recovery Services Vault storage_mode_type = GeoRedundant' }],
        requiredApprovals: [{ approverRole: 'Platform Engineering Lead' }, { approverRole: 'IT Risk & Compliance Lead' }],
      }),
      aiGenerated: false,
    },
    {
      id: 'CC-002', gapId: 'GAP-002', requirementId: 'NIS2-SECURITY-001',
      title: 'Add post-incident review section to Incident Management Procedure',
      description: 'Update Incident Management Procedure v1.4 to v1.5 with structured post-incident review template. Define mandatory approval workflow for post-incident review completion.',
      changeType: 'AMEND_POLICY',
      status: 'APPROVED',
      proposedAt: '2024-12-08',
      approvedAt: '2024-12-15',
      approvedBy: 'CISO',
      publishedAt: '2024-12-18',
      proposedChanges: JSON.stringify({
        documentChanges: [{ documentId: 'IDOC-INC-PROC', changeDescription: 'Add Section 5 — Post-Incident Review with structured template' }],
        processChanges: [{ description: 'Mandatory post-incident review approval within 72h of incident closure' }],
        requiredApprovals: [{ approverRole: 'CISO' }, { approverRole: 'IT Risk & Compliance' }],
      }),
      aiGenerated: false,
    },
  ]
  ccChanges.forEach(c => db.insert(controlChanges).values({ ...c, createdAt: now }).run())

  // ── Product: IT App X ─────────────────────────────────────────────────────
  db.insert(products).values({
    id: 'PROD-APP-X',
    name: 'IT App X',
    type: 'IT_APPLICATION',
    criticality: 'HIGH',
    hostingModel: 'AZURE',
    legalEntity: 'Munich Re Reinsurance Company',
    owner: 'Claims Processing Platform Team',
    description: 'Claims processing application running in Azure OneCloud. High criticality — processes reinsurance claims and associated personal data.',
    status: 'active',
    applicationId: 'APP-X-001',
    createdAt: now,
  }).run()

  // ── Product Applicability ─────────────────────────────────────────────────
  const applicability = [
    {
      id: 'PA-APPX-DORA', productId: 'PROD-APP-X', requirementId: 'DORA-BACKUP-001', sourceId: 'REG-DORA',
      applicable: true,
      applicabilityReason: 'IT App X is classified HIGH criticality and hosted in Azure. DORA Art.12 applies to all HIGH and CRITICAL systems in scope of DORA.',
      assessedAt: '2024-11-10', assessedBy: 'IT Risk & Compliance Lead',
    },
    {
      id: 'PA-APPX-NIS2', productId: 'PROD-APP-X', requirementId: 'NIS2-SECURITY-001', sourceId: 'REG-NIS2',
      applicable: true,
      applicabilityReason: 'Munich Re is classified as an essential entity under NIS2. IT App X as a HIGH criticality application is in scope of NIS2 incident handling requirements.',
      assessedAt: '2024-11-10', assessedBy: 'IT Risk & Compliance Lead',
    },
    {
      id: 'PA-APPX-GDPR', productId: 'PROD-APP-X', requirementId: 'GDPR-RECORDS-001', sourceId: 'REG-GDPR',
      applicable: true,
      applicabilityReason: 'IT App X processes reinsurance claims which contain personal data of policyholders. GDPR Art.30 records of processing activities are required.',
      assessedAt: '2024-11-10', assessedBy: 'DPO',
    },
    {
      id: 'PA-APPX-EUAIA', productId: 'PROD-APP-X', requirementId: 'EUAIA-INVENTORY-001', sourceId: 'REG-EUAIA',
      applicable: false,
      applicabilityReason: 'IT App X is a standard claims processing application. It does not use or deploy AI systems classified as high-risk under the EU AI Act. Not applicable.',
      assessedAt: '2024-11-10', assessedBy: 'AI Governance Lead',
    },
  ]
  applicability.forEach(a => db.insert(productApplicability).values(a).run())

  // ── Product Gaps ──────────────────────────────────────────────────────────
  const pGaps = [
    {
      id: 'PG-001', productId: 'PROD-APP-X', requirementId: 'DORA-BACKUP-001', controlChangeId: 'CC-001',
      title: 'Azure Recovery Services Vault not configured with geo-redundant storage',
      description: 'Current vault configuration uses LocallyRedundant storage. GeoRedundant storage required per approved Control Change CC-001.',
      gapType: 'CONFIGURATION', severity: 'HIGH', status: 'OPEN', detectedAt: '2024-12-06',
    },
    {
      id: 'PG-002', productId: 'PROD-APP-X', requirementId: 'DORA-BACKUP-001', controlChangeId: 'CC-001',
      title: 'System Design Document does not document geo-redundancy configuration',
      description: 'SDD v2.4 Section 5 acknowledges the gap but does not describe the GeoRedundant configuration. Must be updated to reflect approved control.',
      gapType: 'DOCUMENTATION', severity: 'MEDIUM', status: 'OPEN', detectedAt: '2024-12-06',
    },
    {
      id: 'PG-003', productId: 'PROD-APP-X', requirementId: 'NIS2-SECURITY-001', controlChangeId: 'CC-002',
      title: 'Post-incident review not conducted for recent incidents',
      description: 'Approved Control Change CC-002 requires post-incident reviews within 72h of closure. No post-incident review work product exists for IT App X.',
      gapType: 'PROCESS', severity: 'MEDIUM', status: 'OPEN', detectedAt: '2024-12-19',
    },
  ]
  pGaps.forEach(g => db.insert(productGaps).values({ ...g, createdAt: now }).run())

  // ── Remediation Cases ─────────────────────────────────────────────────────
  const rCases = [
    {
      id: 'RC-001',
      productId: 'PROD-APP-X',
      requirementId: 'DORA-BACKUP-001',
      sourceId: 'REG-DORA',
      title: 'Restore DORA Backup Compliance for IT App X',
      description: 'Implement geographically separate backup system and document RTO/RPO targets per DORA Article 12 requirements.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      assignedTo: 'j.smith@munichre.com',
      dueDate: '2025-06-30',
      productGapIds: JSON.stringify(['PG-001', 'PG-002']),
      createdAt: '2025-03-01T09:00:00.000Z',
      resolvedAt: null,
      resolutionNotes: null,
    },
    {
      id: 'RC-002',
      productId: 'PROD-APP-X',
      requirementId: 'NIS2-SECURITY-001',
      sourceId: 'REG-NIS2',
      title: 'NIS2 Security Measures Gap Remediation for IT App X',
      description: 'Address NIS2 Article 21 security measures gap: implement network segmentation policy and incident response procedures.',
      status: 'OPEN',
      priority: 'MEDIUM',
      assignedTo: 'l.weber@munichre.com',
      dueDate: '2025-07-31',
      productGapIds: JSON.stringify([]),
      createdAt: '2025-03-15T10:00:00.000Z',
      resolvedAt: null,
      resolutionNotes: null,
    },
    {
      id: 'RC-003',
      productId: 'PROD-APP-Z',
      requirementId: 'GDPR-RECORDS-001',
      sourceId: 'REG-GDPR',
      title: 'GDPR Records of Processing — Customer Portal',
      description: 'Customer Portal is missing Article 30 records of processing activities. Urgent: data subject requests cannot be fulfilled.',
      status: 'BLOCKED',
      priority: 'CRITICAL',
      assignedTo: 'k.mueller@munichre.com',
      dueDate: '2025-05-31',
      productGapIds: JSON.stringify([]),
      createdAt: '2025-02-15T08:00:00.000Z',
      resolvedAt: null,
      resolutionNotes: null,
    },
  ]
  rCases.forEach(c => db.insert(remediationCases).values(c).run())

  // ── Work Product Definitions ──────────────────────────────────────────────
  const wpDefs = [
    { id: 'WPD-SDD', name: 'System Design Document', type: 'DOCUMENT', description: 'Architecture and configuration documentation for the product.', requiredForObligationTypes: JSON.stringify(['TECHNICAL_CONTROL', 'DOCUMENTATION']) },
    { id: 'WPD-OPS-MANUAL', name: 'Operating Manual', type: 'DOCUMENT', description: 'Operational runbook covering deployment, maintenance, backup and recovery procedures.', requiredForObligationTypes: JSON.stringify(['TECHNICAL_CONTROL', 'PROCESS']) },
    { id: 'WPD-SEC-POLICY', name: 'Security Policy Compliance Evidence', type: 'APPROVAL', description: 'Documented evidence that the product complies with the Information Security Policy.', requiredForObligationTypes: JSON.stringify(['PROCESS', 'GOVERNANCE']) },
    { id: 'WPD-INCIDENT-REVIEW', name: 'Post-Incident Review Record', type: 'PROCESS', description: 'Structured post-incident review completed within 72h of incident closure.', requiredForObligationTypes: JSON.stringify(['PROCESS']) },
    { id: 'WPD-DATA-RECORDS', name: 'Data Processing Records', type: 'DOCUMENT', description: 'Article 30 GDPR records of processing activities for the product.', requiredForObligationTypes: JSON.stringify(['DOCUMENTATION']) },
    { id: 'WPD-IaC', name: 'Infrastructure as Code Change', type: 'REPOSITORY_ARTIFACT', description: 'Terraform or ARM template change implementing a configuration control.', requiredForObligationTypes: JSON.stringify(['TECHNICAL_CONTROL']) },
  ]
  wpDefs.forEach(w => db.insert(workProductDefinitions).values(w).run())

  // ── Product Work Products ─────────────────────────────────────────────────
  const pwps = [
    { id: 'PWP-001', productId: 'PROD-APP-X', definitionId: 'WPD-SDD', requirementId: 'DORA-BACKUP-001', title: 'System Design Document — IT App X (DORA backup update required)', status: 'NOT_FULFILLED', documentId: 'DOC-SDD-001' },
    { id: 'PWP-002', productId: 'PROD-APP-X', definitionId: 'WPD-OPS-MANUAL', requirementId: 'DORA-BACKUP-001', title: 'Operating Manual — IT App X (backup section update required)', status: 'NOT_FULFILLED', documentId: 'DOC-OM-001' },
    { id: 'PWP-003', productId: 'PROD-APP-X', definitionId: 'WPD-INCIDENT-REVIEW', requirementId: 'NIS2-SECURITY-001', title: 'Post-Incident Review Record — IT App X', status: 'NOT_STARTED', documentId: null },
    { id: 'PWP-004', productId: 'PROD-APP-X', definitionId: 'WPD-DATA-RECORDS', requirementId: 'GDPR-RECORDS-001', title: 'GDPR Art.30 Data Processing Records — IT App X', status: 'FULFILLED', documentId: null },
    { id: 'PWP-005', productId: 'PROD-APP-X', definitionId: 'WPD-IaC', requirementId: 'DORA-BACKUP-001', title: 'IaC — Azure Recovery Services Vault geo-redundancy configuration', status: 'NOT_STARTED', documentId: null },
  ]
  pwps.forEach(p => db.insert(productWorkProducts).values({ ...p, content: null, approvalId: null, createdAt: now, updatedAt: now }).run())

  // ── Verification Criteria ─────────────────────────────────────────────────
  const vCriteria = [
    { id: 'VC-DORA-BACKUP-TECH-01', requirementId: 'DORA-BACKUP-001', title: 'Azure Backup policy evaluation — POL-BACKUP-001 (VM Backup Enabled)', description: 'Recovery Services Vault must exist and VM must have active Backup Protected Item.', verifierType: 'TECHNICAL_POLICY', isMandatory: true, expectedValue: JSON.stringify({ status: 'Compliant' }), policyCode: 'POL-BACKUP-001' },
    { id: 'VC-DORA-BACKUP-TECH-02', requirementId: 'DORA-BACKUP-001', title: 'Azure Backup policy evaluation — POL-BACKUP-002 (Geo-Redundant storage)', description: 'Recovery Services Vault must be configured with GeoRedundant storage (GRZ).', verifierType: 'TECHNICAL_POLICY', isMandatory: true, expectedValue: JSON.stringify({ status: 'Compliant' }), policyCode: 'POL-BACKUP-002' },
    { id: 'VC-DORA-BACKUP-DOC-01', requirementId: 'DORA-BACKUP-001', title: 'SDD geo-redundancy section approved', description: 'System Design Document must include updated backup section documenting geo-redundant configuration. Must be approved by document owner.', verifierType: 'DOCUMENT_APPROVAL', isMandatory: true, expectedValue: JSON.stringify({ workProductId: 'PWP-001', status: 'FULFILLED' }), policyCode: null },
    { id: 'VC-NIS2-SEC-PROC-01', requirementId: 'NIS2-SECURITY-001', title: 'Post-incident review record completed and approved', description: 'At least one post-incident review must be completed using the approved template and signed off within 72h of incident closure.', verifierType: 'WORKFLOW_EVIDENCE', isMandatory: true, expectedValue: JSON.stringify({ workProductId: 'PWP-003', status: 'FULFILLED' }), policyCode: null },
    { id: 'VC-GDPR-RECORDS-01', requirementId: 'GDPR-RECORDS-001', title: 'GDPR Art.30 records complete and current', description: 'Data processing records for IT App X must be complete and reviewed within the last 12 months.', verifierType: 'DOCUMENT_APPROVAL', isMandatory: true, expectedValue: JSON.stringify({ workProductId: 'PWP-004', status: 'FULFILLED' }), policyCode: null },
  ]
  vCriteria.forEach(c => db.insert(verificationCriteria).values(c).run())

  // ── Verification Results — GDPR already passes ────────────────────────────
  db.insert(verificationResults).values({
    id: 'VR-GDPR-001',
    criterionId: 'VC-GDPR-RECORDS-01',
    productId: 'PROD-APP-X',
    requirementId: 'GDPR-RECORDS-001',
    remediationCaseId: null,
    status: 'PASSED',
    observedValue: JSON.stringify({ workProductStatus: 'FULFILLED', lastReviewedAt: '2024-10-01' }),
    evidenceReference: 'PWP-004',
    verifiedAt: '2024-10-15',
    notes: 'GDPR Art.30 records reviewed and confirmed complete by DPO.',
  }).run()

  // ── Evidence Packages — GDPR complete ────────────────────────────────────
  db.insert(evidencePackages).values({
    id: 'EP-GDPR-001',
    productId: 'PROD-APP-X',
    requirementId: 'GDPR-RECORDS-001',
    remediationCaseId: null,
    status: 'COMPLETE',
    verificationResultIds: JSON.stringify(['VR-GDPR-001']),
    evidenceArtifactIds: JSON.stringify([]),
    assembledAt: '2024-10-15',
    approvedAt: '2024-10-16',
    approvedBy: 'DPO',
    createdAt: now,
  }).run()

  // ── Requirement Status History ────────────────────────────────────────────
  const statusHistory = [
    // DORA — Non-compliant (baseline gap identified)
    {
      id: randomUUID(), productId: 'PROD-APP-X', requirementId: 'DORA-BACKUP-001', sourceId: 'REG-DORA',
      status: 'NON_COMPLIANT', previousStatus: 'NOT_ASSESSED',
      reason: 'Compliance gap GAP-001 identified: geo-redundancy not implemented. Control Change CC-001 approved and published.',
      controlChangeId: 'CC-001', remediationCaseId: null, evidencePackageId: null,
      transitionedAt: '2024-12-05', transitionedBy: 'IT Risk & Compliance Lead', correlationId: 'GAP-001',
    },
    // NIS2 — Non-compliant (baseline gap identified)
    {
      id: randomUUID(), productId: 'PROD-APP-X', requirementId: 'NIS2-SECURITY-001', sourceId: 'REG-NIS2',
      status: 'NON_COMPLIANT', previousStatus: 'NOT_ASSESSED',
      reason: 'Compliance gap GAP-002 identified: post-incident review process not in place. Control Change CC-002 approved and published.',
      controlChangeId: 'CC-002', remediationCaseId: null, evidencePackageId: null,
      transitionedAt: '2024-12-18', transitionedBy: 'IT Risk & Compliance Lead', correlationId: 'GAP-002',
    },
    // GDPR — Compliant (records already in order)
    {
      id: randomUUID(), productId: 'PROD-APP-X', requirementId: 'GDPR-RECORDS-001', sourceId: 'REG-GDPR',
      status: 'COMPLIANT', previousStatus: 'NOT_ASSESSED',
      reason: 'GDPR Art.30 records confirmed complete and current by DPO. Evidence package EP-GDPR-001 approved.',
      controlChangeId: null, remediationCaseId: null, evidencePackageId: 'EP-GDPR-001',
      transitionedAt: '2024-10-16', transitionedBy: 'DPO', correlationId: 'EP-GDPR-001',
    },
    // EU AI Act — Not applicable
    {
      id: randomUUID(), productId: 'PROD-APP-X', requirementId: 'EUAIA-INVENTORY-001', sourceId: 'REG-EUAIA',
      status: 'NOT_APPLICABLE', previousStatus: 'NOT_ASSESSED',
      reason: 'IT App X is not an AI system. EU AI Act high-risk AI system registration requirement is not applicable.',
      controlChangeId: null, remediationCaseId: null, evidencePackageId: null,
      transitionedAt: '2024-11-10', transitionedBy: 'AI Governance Lead', correlationId: 'PA-APPX-EUAIA',
    },
  ]
  statusHistory.forEach(s => db.insert(requirementStatusHistory).values(s).run())

  // ── DDCR Reporting Records — current snapshot ─────────────────────────────
  const ddcrRecords = [
    // Requirement-level
    { id: randomUUID(), productId: 'PROD-APP-X', requirementId: 'DORA-BACKUP-001', sourceId: 'REG-DORA', status: 'NON_COMPLIANT', effectiveAt: '2024-12-05', evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'Geo-redundancy gap identified. Remediation in progress.' },
    { id: randomUUID(), productId: 'PROD-APP-X', requirementId: 'NIS2-SECURITY-001', sourceId: 'REG-NIS2', status: 'NON_COMPLIANT', effectiveAt: '2024-12-18', evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'Post-incident review process gap identified. Remediation in progress.' },
    { id: randomUUID(), productId: 'PROD-APP-X', requirementId: 'GDPR-RECORDS-001', sourceId: 'REG-GDPR', status: 'COMPLIANT', effectiveAt: '2024-10-16', evidencePackageId: 'EP-GDPR-001', reportedAt: now, reportedBy: 'DPO', notes: 'Art.30 records confirmed complete.' },
    { id: randomUUID(), productId: 'PROD-APP-X', requirementId: 'EUAIA-INVENTORY-001', sourceId: 'REG-EUAIA', status: 'NOT_APPLICABLE', effectiveAt: '2024-11-10', evidencePackageId: null, reportedAt: now, reportedBy: 'AI Governance Lead', notes: 'IT App X is not an AI system.' },
    // Regulation-level aggregates
    { id: randomUUID(), productId: 'PROD-APP-X', requirementId: null, sourceId: 'REG-DORA', status: 'NON_COMPLIANT', effectiveAt: now, evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'DORA overall: 1 of 1 applicable requirement non-compliant.' },
    { id: randomUUID(), productId: 'PROD-APP-X', requirementId: null, sourceId: 'REG-NIS2', status: 'NON_COMPLIANT', effectiveAt: now, evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'NIS2 overall: 1 of 1 applicable requirement non-compliant.' },
    { id: randomUUID(), productId: 'PROD-APP-X', requirementId: null, sourceId: 'REG-GDPR', status: 'COMPLIANT', effectiveAt: now, evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'GDPR overall: 1 of 1 applicable requirement compliant.' },
    { id: randomUUID(), productId: 'PROD-APP-X', requirementId: null, sourceId: 'REG-EUAIA', status: 'NOT_APPLICABLE', effectiveAt: now, evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'EU AI Act: not applicable to this product.' },
    // Product-level aggregate (NON_COMPLIANT because DORA + NIS2 open)
    { id: randomUUID(), productId: 'PROD-APP-X', requirementId: null, sourceId: null, status: 'NON_COMPLIANT', effectiveAt: now, evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'IT App X overall: 2 of 3 applicable requirements non-compliant.' },
  ]
  ddcrRecords.forEach(r => db.insert(ddcrReportingRecords).values(r).run())

  // ── NEW PRODUCTS: Y, Z, W, V ─────────────────────────────────────────────

  // ── Applications (new) ───────────────────────────────────────────────────
  db.insert(applications).values({
    id: 'APP-Y-001',
    name: 'Trading Platform',
    businessService: 'Risk & Trading',
    criticality: 'Critical',
    environment: 'Azure OneCloud',
    owner: 'Risk & Trading IT',
  }).run()

  db.insert(applications).values({
    id: 'APP-Z-001',
    name: 'Customer Portal',
    businessService: 'Digital Channels',
    criticality: 'High',
    environment: 'Azure OneCloud',
    owner: 'Digital Channels IT',
  }).run()

  db.insert(applications).values({
    id: 'APP-W-001',
    name: 'Internal Analytics',
    businessService: 'Data Science',
    criticality: 'Medium',
    environment: 'On-Premise',
    owner: 'Data Science',
  }).run()

  db.insert(applications).values({
    id: 'APP-V-001',
    name: 'AI Underwriting Engine',
    businessService: 'Underwriting',
    criticality: 'High',
    environment: 'Hybrid',
    owner: 'AI Centre of Excellence',
  }).run()

  // ── Portfolio Apps (new) ──────────────────────────────────────────────────
  db.insert(portfolioApps).values({
    id: 'PA-APP-Y-001',
    appId: 'APP-Y-001',
    name: 'Trading Platform',
    criticality: 'Critical',
    backupCompliant: true,
    geoRedundant: true,
    exceptions: '[]',
  }).run()

  db.insert(portfolioApps).values({
    id: 'PA-APP-Z-001',
    appId: 'APP-Z-001',
    name: 'Customer Portal',
    criticality: 'High',
    backupCompliant: false,
    geoRedundant: false,
    exceptions: JSON.stringify([{ type: 'risk-acceptance', description: 'Backup not configured — remediation pending', raisedDate: '2025-03-01' }]),
  }).run()

  db.insert(portfolioApps).values({
    id: 'PA-APP-W-001',
    appId: 'APP-W-001',
    name: 'Internal Analytics',
    criticality: 'Medium',
    backupCompliant: false,
    geoRedundant: false,
    exceptions: '[]',
  }).run()

  db.insert(portfolioApps).values({
    id: 'PA-APP-V-001',
    appId: 'APP-V-001',
    name: 'AI Underwriting Engine',
    criticality: 'High',
    backupCompliant: true,
    geoRedundant: true,
    exceptions: '[]',
  }).run()

  // ── Products (new) ────────────────────────────────────────────────────────
  db.insert(products).values({
    id: 'PROD-APP-Y',
    name: 'Trading Platform',
    type: 'IT_APPLICATION',
    criticality: 'CRITICAL',
    hostingModel: 'AZURE',
    legalEntity: 'Munich Re Reinsurance Company',
    owner: 'Risk & Trading IT',
    description: 'Core trading platform for risk and trading operations. Critical system processing significant transaction volumes across all trading desks.',
    status: 'active',
    applicationId: 'APP-Y-001',
    createdAt: now,
  }).run()

  db.insert(products).values({
    id: 'PROD-APP-Z',
    name: 'Customer Portal',
    type: 'IT_APPLICATION',
    criticality: 'HIGH',
    hostingModel: 'AZURE',
    legalEntity: 'Munich Re Reinsurance Company',
    owner: 'Digital Channels IT',
    description: 'Customer-facing portal for policy management and claims submission. Processes personal data of policyholders and claimants.',
    status: 'active',
    applicationId: 'APP-Z-001',
    createdAt: now,
  }).run()

  db.insert(products).values({
    id: 'PROD-APP-W',
    name: 'Internal Analytics',
    type: 'IT_APPLICATION',
    criticality: 'MEDIUM',
    hostingModel: 'ON_PREMISE',
    legalEntity: 'Munich Re Reinsurance Company',
    owner: 'Data Science',
    description: 'Internal analytics platform for business intelligence and data science workloads. Recently onboarded — compliance assessment not yet started.',
    status: 'active',
    applicationId: 'APP-W-001',
    createdAt: now,
  }).run()

  db.insert(products).values({
    id: 'PROD-APP-V',
    name: 'AI Underwriting Engine',
    type: 'AI_APPLICATION',
    criticality: 'HIGH',
    hostingModel: 'HYBRID',
    legalEntity: 'Munich Re Reinsurance Company',
    owner: 'AI Centre of Excellence',
    description: 'AI-powered underwriting engine using machine learning for risk assessment decisions. Classified as a high-risk AI system under EU AI Act Annex III.',
    status: 'active',
    applicationId: 'APP-V-001',
    createdAt: now,
  }).run()

  // ── Product Applicability — PROD-APP-Y (Trading Platform) ────────────────
  const applicabilityY = [
    {
      id: 'PA-APPY-DORA', productId: 'PROD-APP-Y', requirementId: 'DORA-BACKUP-001', sourceId: 'REG-DORA',
      applicable: true,
      applicabilityReason: 'Trading Platform is classified CRITICAL and hosted in Azure. DORA Art.12 applies to all HIGH and CRITICAL systems in scope of DORA.',
      assessedAt: '2025-01-10', assessedBy: 'IT Risk & Compliance Lead',
    },
    {
      id: 'PA-APPY-NIS2', productId: 'PROD-APP-Y', requirementId: 'NIS2-SECURITY-001', sourceId: 'REG-NIS2',
      applicable: true,
      applicabilityReason: 'Munich Re is classified as an essential entity under NIS2. Trading Platform as a CRITICAL application is in scope of NIS2 incident handling requirements.',
      assessedAt: '2025-01-10', assessedBy: 'IT Risk & Compliance Lead',
    },
    {
      id: 'PA-APPY-GDPR', productId: 'PROD-APP-Y', requirementId: 'GDPR-RECORDS-001', sourceId: 'REG-GDPR',
      applicable: true,
      applicabilityReason: 'Trading Platform processes personal data of traders and counterparties. GDPR Art.30 records of processing activities are required.',
      assessedAt: '2025-01-10', assessedBy: 'DPO',
    },
    {
      id: 'PA-APPY-EUAIA', productId: 'PROD-APP-Y', requirementId: 'EUAIA-INVENTORY-001', sourceId: 'REG-EUAIA',
      applicable: false,
      applicabilityReason: 'Trading Platform is a standard trading system. It does not deploy high-risk AI systems under the EU AI Act. Not applicable.',
      assessedAt: '2025-01-10', assessedBy: 'AI Governance Lead',
    },
  ]
  applicabilityY.forEach(a => db.insert(productApplicability).values(a).run())

  // ── Product Applicability — PROD-APP-Z (Customer Portal) ─────────────────
  const applicabilityZ = [
    {
      id: 'PA-APPZ-DORA', productId: 'PROD-APP-Z', requirementId: 'DORA-BACKUP-001', sourceId: 'REG-DORA',
      applicable: true,
      applicabilityReason: 'Customer Portal is classified HIGH and hosted in Azure. DORA Art.12 backup geo-redundancy requirements apply.',
      assessedAt: '2025-02-05', assessedBy: 'IT Risk & Compliance Lead',
    },
    {
      id: 'PA-APPZ-NIS2', productId: 'PROD-APP-Z', requirementId: 'NIS2-SECURITY-001', sourceId: 'REG-NIS2',
      applicable: true,
      applicabilityReason: 'Customer Portal handles sensitive policyholder data and is HIGH criticality. NIS2 incident handling requirements apply.',
      assessedAt: '2025-02-05', assessedBy: 'IT Risk & Compliance Lead',
    },
    {
      id: 'PA-APPZ-GDPR', productId: 'PROD-APP-Z', requirementId: 'GDPR-RECORDS-001', sourceId: 'REG-GDPR',
      applicable: true,
      applicabilityReason: 'Customer Portal is the primary system processing policyholder personal data. GDPR Art.30 records of processing activities are required.',
      assessedAt: '2025-02-05', assessedBy: 'DPO',
    },
    {
      id: 'PA-APPZ-EUAIA', productId: 'PROD-APP-Z', requirementId: 'EUAIA-INVENTORY-001', sourceId: 'REG-EUAIA',
      applicable: false,
      applicabilityReason: 'Customer Portal does not deploy AI systems. EU AI Act high-risk AI system registration requirement is not applicable.',
      assessedAt: '2025-02-05', assessedBy: 'AI Governance Lead',
    },
  ]
  applicabilityZ.forEach(a => db.insert(productApplicability).values(a).run())

  // ── Product Applicability — PROD-APP-V (AI Underwriting Engine) ───────────
  const applicabilityV = [
    {
      id: 'PA-APPV-DORA', productId: 'PROD-APP-V', requirementId: 'DORA-BACKUP-001', sourceId: 'REG-DORA',
      applicable: true,
      applicabilityReason: 'AI Underwriting Engine is classified HIGH in a HYBRID environment. DORA Art.12 backup geo-redundancy requirements apply.',
      assessedAt: '2025-03-15', assessedBy: 'IT Risk & Compliance Lead',
    },
    {
      id: 'PA-APPV-NIS2', productId: 'PROD-APP-V', requirementId: 'NIS2-SECURITY-001', sourceId: 'REG-NIS2',
      applicable: true,
      applicabilityReason: 'AI Underwriting Engine is HIGH criticality and underpins core underwriting decisions. NIS2 incident handling requirements apply.',
      assessedAt: '2025-03-15', assessedBy: 'IT Risk & Compliance Lead',
    },
    {
      id: 'PA-APPV-GDPR', productId: 'PROD-APP-V', requirementId: 'GDPR-RECORDS-001', sourceId: 'REG-GDPR',
      applicable: true,
      applicabilityReason: 'AI Underwriting Engine processes applicant personal data for risk assessment. GDPR Art.30 records of processing activities are required, including documentation of automated decision-making.',
      assessedAt: '2025-03-15', assessedBy: 'DPO',
    },
    {
      id: 'PA-APPV-EUAIA', productId: 'PROD-APP-V', requirementId: 'EUAIA-INVENTORY-001', sourceId: 'REG-EUAIA',
      applicable: true,
      applicabilityReason: 'AI Underwriting Engine is a high-risk AI system under EU AI Act Annex III (insurance underwriting). Registration in the EU AI database is required before deployment.',
      assessedAt: '2025-03-15', assessedBy: 'AI Governance Lead',
    },
  ]
  applicabilityV.forEach(a => db.insert(productApplicability).values(a).run())

  // ── Product Gaps — PROD-APP-Z (Customer Portal) ───────────────────────────
  db.insert(productGaps).values({
    id: 'PG-Z-001', productId: 'PROD-APP-Z', requirementId: 'NIS2-SECURITY-001', controlChangeId: 'CC-002',
    title: 'Incident handling process not formally documented for Customer Portal',
    description: 'NIS2 Art.21(2)(b) requires formal incident handling policies and procedures. Customer Portal lacks a documented system-specific incident response procedure, including detection, containment, recovery and post-incident review sections.',
    gapType: 'PROCESS', severity: 'HIGH', status: 'OPEN', detectedAt: '2025-02-10',
    createdAt: now,
  }).run()

  db.insert(productGaps).values({
    id: 'PG-Z-002', productId: 'PROD-APP-Z', requirementId: 'GDPR-RECORDS-001', controlChangeId: null,
    title: 'GDPR Art.30 records of processing activities outdated for Customer Portal',
    description: 'Customer Portal processes policyholder personal data but the Art.30 records have not been reviewed or updated in over 18 months. Records are incomplete and do not reflect current processing activities.',
    gapType: 'DOCUMENTATION', severity: 'MEDIUM', status: 'OPEN', detectedAt: '2025-02-10',
    createdAt: now,
  }).run()

  // ── Product Gaps — PROD-APP-V (AI Underwriting Engine) ───────────────────
  db.insert(productGaps).values({
    id: 'PG-V-001', productId: 'PROD-APP-V', requirementId: 'EUAIA-INVENTORY-001', controlChangeId: null,
    title: 'AI Underwriting Engine not registered in EU AI Act database',
    description: 'EU AI Act Art.49 requires high-risk AI systems to be registered in the EU AI database before being placed on the market or put into service. AI Underwriting Engine is already in production but registration has not been completed.',
    gapType: 'GOVERNANCE', severity: 'HIGH', status: 'OPEN', detectedAt: '2025-04-01',
    createdAt: now,
  }).run()

  // ── Verification Results (for new evidence packages) ──────────────────────
  db.insert(verificationResults).values({
    id: 'VR-Y-DORA',
    criterionId: 'VC-DORA-BACKUP-TECH-01',
    productId: 'PROD-APP-Y',
    requirementId: 'DORA-BACKUP-001',
    remediationCaseId: null,
    status: 'PASSED',
    observedValue: JSON.stringify({ backupEnabled: true, geoRedundant: true, storageRedundancy: 'GeoRedundant', evaluatedAt: '2025-01-20' }),
    evidenceReference: 'EP-Y-DORA',
    verifiedAt: '2025-01-20',
    notes: 'DORA Art.12 backup geo-redundancy verified via automated policy evaluation. Azure Recovery Services Vault confirmed with GeoRedundant storage.',
  }).run()

  db.insert(verificationResults).values({
    id: 'VR-Y-NIS2',
    criterionId: 'VC-NIS2-SEC-PROC-01',
    productId: 'PROD-APP-Y',
    requirementId: 'NIS2-SECURITY-001',
    remediationCaseId: null,
    status: 'PASSED',
    observedValue: JSON.stringify({ postIncidentReviewComplete: true, reviewedAt: '2025-01-15', procedureVersion: '2.1' }),
    evidenceReference: 'EP-Y-NIS2',
    verifiedAt: '2025-01-20',
    notes: 'NIS2 incident handling process verified. Post-incident review record confirmed complete and approved within required 72h window.',
  }).run()

  db.insert(verificationResults).values({
    id: 'VR-Y-GDPR',
    criterionId: 'VC-GDPR-RECORDS-01',
    productId: 'PROD-APP-Y',
    requirementId: 'GDPR-RECORDS-001',
    remediationCaseId: null,
    status: 'PASSED',
    observedValue: JSON.stringify({ workProductStatus: 'FULFILLED', lastReviewedAt: '2025-01-10' }),
    evidenceReference: 'EP-Y-GDPR',
    verifiedAt: '2025-01-20',
    notes: 'GDPR Art.30 records reviewed and confirmed complete for Trading Platform by DPO.',
  }).run()

  db.insert(verificationResults).values({
    id: 'VR-Z-DORA',
    criterionId: 'VC-DORA-BACKUP-TECH-01',
    productId: 'PROD-APP-Z',
    requirementId: 'DORA-BACKUP-001',
    remediationCaseId: null,
    status: 'PASSED',
    observedValue: JSON.stringify({ backupEnabled: true, geoRedundant: true, storageRedundancy: 'GeoRedundant', evaluatedAt: '2025-02-20' }),
    evidenceReference: 'EP-Z-DORA',
    verifiedAt: '2025-02-20',
    notes: 'DORA backup geo-redundancy verified for Customer Portal. Azure Recovery Services Vault configured with GeoRedundant storage.',
  }).run()

  // ── Evidence Packages (new) ───────────────────────────────────────────────
  db.insert(evidencePackages).values({
    id: 'EP-Y-DORA',
    productId: 'PROD-APP-Y',
    requirementId: 'DORA-BACKUP-001',
    remediationCaseId: null,
    status: 'COMPLETE',
    verificationResultIds: JSON.stringify(['VR-Y-DORA']),
    evidenceArtifactIds: JSON.stringify([]),
    assembledAt: '2025-01-20',
    approvedAt: '2025-01-21',
    approvedBy: 'IT Risk & Compliance Lead',
    createdAt: now,
  }).run()

  db.insert(evidencePackages).values({
    id: 'EP-Y-NIS2',
    productId: 'PROD-APP-Y',
    requirementId: 'NIS2-SECURITY-001',
    remediationCaseId: null,
    status: 'COMPLETE',
    verificationResultIds: JSON.stringify(['VR-Y-NIS2']),
    evidenceArtifactIds: JSON.stringify([]),
    assembledAt: '2025-01-20',
    approvedAt: '2025-01-21',
    approvedBy: 'IT Risk & Compliance Lead',
    createdAt: now,
  }).run()

  db.insert(evidencePackages).values({
    id: 'EP-Y-GDPR',
    productId: 'PROD-APP-Y',
    requirementId: 'GDPR-RECORDS-001',
    remediationCaseId: null,
    status: 'COMPLETE',
    verificationResultIds: JSON.stringify(['VR-Y-GDPR']),
    evidenceArtifactIds: JSON.stringify([]),
    assembledAt: '2025-01-20',
    approvedAt: '2025-01-21',
    approvedBy: 'DPO',
    createdAt: now,
  }).run()

  db.insert(evidencePackages).values({
    id: 'EP-Z-DORA',
    productId: 'PROD-APP-Z',
    requirementId: 'DORA-BACKUP-001',
    remediationCaseId: null,
    status: 'COMPLETE',
    verificationResultIds: JSON.stringify(['VR-Z-DORA']),
    evidenceArtifactIds: JSON.stringify([]),
    assembledAt: '2025-02-20',
    approvedAt: '2025-02-21',
    approvedBy: 'IT Risk & Compliance Lead',
    createdAt: now,
  }).run()

  // ── Requirement Status History — PROD-APP-Y (Trading Platform, all compliant) ──
  const statusHistoryY = [
    {
      id: 'RSH-Y-DORA', productId: 'PROD-APP-Y', requirementId: 'DORA-BACKUP-001', sourceId: 'REG-DORA',
      status: 'COMPLIANT', previousStatus: 'NOT_ASSESSED',
      reason: 'DORA Art.12 backup geo-redundancy verified for Trading Platform. Evidence package EP-Y-DORA approved.',
      controlChangeId: null, remediationCaseId: null, evidencePackageId: 'EP-Y-DORA',
      transitionedAt: '2025-01-21', transitionedBy: 'IT Risk & Compliance Lead', correlationId: 'EP-Y-DORA',
    },
    {
      id: 'RSH-Y-NIS2', productId: 'PROD-APP-Y', requirementId: 'NIS2-SECURITY-001', sourceId: 'REG-NIS2',
      status: 'COMPLIANT', previousStatus: 'NOT_ASSESSED',
      reason: 'NIS2 incident handling process verified for Trading Platform. Evidence package EP-Y-NIS2 approved.',
      controlChangeId: null, remediationCaseId: null, evidencePackageId: 'EP-Y-NIS2',
      transitionedAt: '2025-01-21', transitionedBy: 'IT Risk & Compliance Lead', correlationId: 'EP-Y-NIS2',
    },
    {
      id: 'RSH-Y-GDPR', productId: 'PROD-APP-Y', requirementId: 'GDPR-RECORDS-001', sourceId: 'REG-GDPR',
      status: 'COMPLIANT', previousStatus: 'NOT_ASSESSED',
      reason: 'GDPR Art.30 records confirmed complete and current by DPO. Evidence package EP-Y-GDPR approved.',
      controlChangeId: null, remediationCaseId: null, evidencePackageId: 'EP-Y-GDPR',
      transitionedAt: '2025-01-21', transitionedBy: 'DPO', correlationId: 'EP-Y-GDPR',
    },
    {
      id: 'RSH-Y-EUAIA', productId: 'PROD-APP-Y', requirementId: 'EUAIA-INVENTORY-001', sourceId: 'REG-EUAIA',
      status: 'NOT_APPLICABLE', previousStatus: 'NOT_ASSESSED',
      reason: 'Trading Platform is not an AI system. EU AI Act high-risk AI registration requirement is not applicable.',
      controlChangeId: null, remediationCaseId: null, evidencePackageId: null,
      transitionedAt: '2025-01-10', transitionedBy: 'AI Governance Lead', correlationId: 'PA-APPY-EUAIA',
    },
  ]
  statusHistoryY.forEach(s => db.insert(requirementStatusHistory).values(s).run())

  // ── Requirement Status History — PROD-APP-Z (Customer Portal, mixed) ──────
  const statusHistoryZ = [
    {
      id: 'RSH-Z-DORA', productId: 'PROD-APP-Z', requirementId: 'DORA-BACKUP-001', sourceId: 'REG-DORA',
      status: 'COMPLIANT', previousStatus: 'NOT_ASSESSED',
      reason: 'DORA Art.12 backup geo-redundancy verified for Customer Portal. Evidence package EP-Z-DORA approved.',
      controlChangeId: null, remediationCaseId: null, evidencePackageId: 'EP-Z-DORA',
      transitionedAt: '2025-02-21', transitionedBy: 'IT Risk & Compliance Lead', correlationId: 'EP-Z-DORA',
    },
    {
      id: 'RSH-Z-NIS2', productId: 'PROD-APP-Z', requirementId: 'NIS2-SECURITY-001', sourceId: 'REG-NIS2',
      status: 'NON_COMPLIANT', previousStatus: 'NOT_ASSESSED',
      reason: 'Incident handling process gap identified. Customer Portal lacks a documented system-specific incident response procedure.',
      controlChangeId: 'CC-002', remediationCaseId: null, evidencePackageId: null,
      transitionedAt: '2025-02-10', transitionedBy: 'IT Risk & Compliance Lead', correlationId: 'PG-Z-001',
    },
    {
      id: 'RSH-Z-GDPR', productId: 'PROD-APP-Z', requirementId: 'GDPR-RECORDS-001', sourceId: 'REG-GDPR',
      status: 'NON_COMPLIANT', previousStatus: 'NOT_ASSESSED',
      reason: 'GDPR Art.30 records not maintained. Records not reviewed or updated in over 18 months and are no longer current.',
      controlChangeId: null, remediationCaseId: null, evidencePackageId: null,
      transitionedAt: '2025-02-10', transitionedBy: 'DPO', correlationId: 'PG-Z-002',
    },
    {
      id: 'RSH-Z-EUAIA', productId: 'PROD-APP-Z', requirementId: 'EUAIA-INVENTORY-001', sourceId: 'REG-EUAIA',
      status: 'NOT_APPLICABLE', previousStatus: 'NOT_ASSESSED',
      reason: 'Customer Portal does not deploy AI systems. EU AI Act high-risk AI registration requirement is not applicable.',
      controlChangeId: null, remediationCaseId: null, evidencePackageId: null,
      transitionedAt: '2025-02-05', transitionedBy: 'AI Governance Lead', correlationId: 'PA-APPZ-EUAIA',
    },
  ]
  statusHistoryZ.forEach(s => db.insert(requirementStatusHistory).values(s).run())

  // ── Requirement Status History — PROD-APP-V (AI product, EU AI Act non-compliant) ──
  const statusHistoryV = [
    {
      id: 'RSH-V-DORA', productId: 'PROD-APP-V', requirementId: 'DORA-BACKUP-001', sourceId: 'REG-DORA',
      status: 'COMPLIANT', previousStatus: 'NOT_ASSESSED',
      reason: 'DORA Art.12 backup geo-redundancy verified for AI Underwriting Engine. Hybrid deployment uses geo-redundant storage in both cloud and on-premise components.',
      controlChangeId: null, remediationCaseId: null, evidencePackageId: null,
      transitionedAt: '2025-03-20', transitionedBy: 'IT Risk & Compliance Lead', correlationId: 'PA-APPV-DORA',
    },
    {
      id: 'RSH-V-NIS2', productId: 'PROD-APP-V', requirementId: 'NIS2-SECURITY-001', sourceId: 'REG-NIS2',
      status: 'COMPLIANT', previousStatus: 'NOT_ASSESSED',
      reason: 'NIS2 incident handling process verified for AI Underwriting Engine. Incident response procedures documented, tested and approved.',
      controlChangeId: null, remediationCaseId: null, evidencePackageId: null,
      transitionedAt: '2025-03-20', transitionedBy: 'IT Risk & Compliance Lead', correlationId: 'PA-APPV-NIS2',
    },
    {
      id: 'RSH-V-GDPR', productId: 'PROD-APP-V', requirementId: 'GDPR-RECORDS-001', sourceId: 'REG-GDPR',
      status: 'COMPLIANT', previousStatus: 'NOT_ASSESSED',
      reason: 'GDPR Art.30 records confirmed complete by DPO. Records include documentation of automated decision-making under Art.22 as required for AI underwriting.',
      controlChangeId: null, remediationCaseId: null, evidencePackageId: null,
      transitionedAt: '2025-03-20', transitionedBy: 'DPO', correlationId: 'PA-APPV-GDPR',
    },
    {
      id: 'RSH-V-EUAIA', productId: 'PROD-APP-V', requirementId: 'EUAIA-INVENTORY-001', sourceId: 'REG-EUAIA',
      status: 'NON_COMPLIANT', previousStatus: 'NOT_ASSESSED',
      reason: 'AI Underwriting Engine is a high-risk AI system (Annex III — insurance underwriting) but has not been registered in the EU AI database. System is in production without completing mandatory registration.',
      controlChangeId: null, remediationCaseId: null, evidencePackageId: null,
      transitionedAt: '2025-04-01', transitionedBy: 'AI Governance Lead', correlationId: 'PG-V-001',
    },
  ]
  statusHistoryV.forEach(s => db.insert(requirementStatusHistory).values(s).run())

  // ── DDCR Reporting Records — PROD-APP-Y (Trading Platform, fully compliant) ─
  const ddcrY = [
    // Requirement-level
    { id: 'DDCR-Y-DORA-REQ', productId: 'PROD-APP-Y', requirementId: 'DORA-BACKUP-001', sourceId: 'REG-DORA', status: 'COMPLIANT', effectiveAt: '2025-01-21', evidencePackageId: 'EP-Y-DORA', reportedAt: now, reportedBy: 'IT Risk & Compliance Lead', notes: 'Backup geo-redundancy fully implemented and verified for Trading Platform.' },
    { id: 'DDCR-Y-NIS2-REQ', productId: 'PROD-APP-Y', requirementId: 'NIS2-SECURITY-001', sourceId: 'REG-NIS2', status: 'COMPLIANT', effectiveAt: '2025-01-21', evidencePackageId: 'EP-Y-NIS2', reportedAt: now, reportedBy: 'IT Risk & Compliance Lead', notes: 'Incident handling process documented and verified.' },
    { id: 'DDCR-Y-GDPR-REQ', productId: 'PROD-APP-Y', requirementId: 'GDPR-RECORDS-001', sourceId: 'REG-GDPR', status: 'COMPLIANT', effectiveAt: '2025-01-21', evidencePackageId: 'EP-Y-GDPR', reportedAt: now, reportedBy: 'DPO', notes: 'Art.30 records complete and current.' },
    { id: 'DDCR-Y-EUAIA-REQ', productId: 'PROD-APP-Y', requirementId: 'EUAIA-INVENTORY-001', sourceId: 'REG-EUAIA', status: 'NOT_APPLICABLE', effectiveAt: '2025-01-10', evidencePackageId: null, reportedAt: now, reportedBy: 'AI Governance Lead', notes: 'Trading Platform is not an AI system.' },
    // Regulation-level aggregates
    { id: 'DDCR-Y-DORA', productId: 'PROD-APP-Y', requirementId: null, sourceId: 'REG-DORA', status: 'COMPLIANT', effectiveAt: now, evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'DORA overall: 1 of 1 applicable requirement compliant.' },
    { id: 'DDCR-Y-NIS2', productId: 'PROD-APP-Y', requirementId: null, sourceId: 'REG-NIS2', status: 'COMPLIANT', effectiveAt: now, evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'NIS2 overall: 1 of 1 applicable requirement compliant.' },
    { id: 'DDCR-Y-GDPR', productId: 'PROD-APP-Y', requirementId: null, sourceId: 'REG-GDPR', status: 'COMPLIANT', effectiveAt: now, evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'GDPR overall: 1 of 1 applicable requirement compliant.' },
    { id: 'DDCR-Y-EUAIA', productId: 'PROD-APP-Y', requirementId: null, sourceId: 'REG-EUAIA', status: 'NOT_APPLICABLE', effectiveAt: now, evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'EU AI Act: not applicable to Trading Platform.' },
    // Product-level aggregate
    { id: 'DDCR-Y-PROD', productId: 'PROD-APP-Y', requirementId: null, sourceId: null, status: 'COMPLIANT', effectiveAt: now, evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'Trading Platform overall: all 3 applicable requirements compliant.' },
  ]
  ddcrY.forEach(r => db.insert(ddcrReportingRecords).values(r).run())

  // ── DDCR Reporting Records — PROD-APP-Z (Customer Portal, mixed) ──────────
  const ddcrZ = [
    // Requirement-level
    { id: 'DDCR-Z-DORA-REQ', productId: 'PROD-APP-Z', requirementId: 'DORA-BACKUP-001', sourceId: 'REG-DORA', status: 'COMPLIANT', effectiveAt: '2025-02-21', evidencePackageId: 'EP-Z-DORA', reportedAt: now, reportedBy: 'IT Risk & Compliance Lead', notes: 'Backup geo-redundancy implemented and verified for Customer Portal.' },
    { id: 'DDCR-Z-NIS2-REQ', productId: 'PROD-APP-Z', requirementId: 'NIS2-SECURITY-001', sourceId: 'REG-NIS2', status: 'NON_COMPLIANT', effectiveAt: '2025-02-10', evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'Incident handling process gap. No documented system-specific procedure exists for Customer Portal.' },
    { id: 'DDCR-Z-GDPR-REQ', productId: 'PROD-APP-Z', requirementId: 'GDPR-RECORDS-001', sourceId: 'REG-GDPR', status: 'NON_COMPLIANT', effectiveAt: '2025-02-10', evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'Art.30 records outdated (>18 months). Remediation required.' },
    { id: 'DDCR-Z-EUAIA-REQ', productId: 'PROD-APP-Z', requirementId: 'EUAIA-INVENTORY-001', sourceId: 'REG-EUAIA', status: 'NOT_APPLICABLE', effectiveAt: '2025-02-05', evidencePackageId: null, reportedAt: now, reportedBy: 'AI Governance Lead', notes: 'Customer Portal is not an AI system.' },
    // Regulation-level aggregates
    { id: 'DDCR-Z-DORA', productId: 'PROD-APP-Z', requirementId: null, sourceId: 'REG-DORA', status: 'COMPLIANT', effectiveAt: now, evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'DORA overall: 1 of 1 applicable requirement compliant.' },
    { id: 'DDCR-Z-NIS2', productId: 'PROD-APP-Z', requirementId: null, sourceId: 'REG-NIS2', status: 'NON_COMPLIANT', effectiveAt: now, evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'NIS2 overall: 1 of 1 applicable requirement non-compliant.' },
    { id: 'DDCR-Z-GDPR', productId: 'PROD-APP-Z', requirementId: null, sourceId: 'REG-GDPR', status: 'NON_COMPLIANT', effectiveAt: now, evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'GDPR overall: 1 of 1 applicable requirement non-compliant.' },
    { id: 'DDCR-Z-EUAIA', productId: 'PROD-APP-Z', requirementId: null, sourceId: 'REG-EUAIA', status: 'NOT_APPLICABLE', effectiveAt: now, evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'EU AI Act: not applicable to Customer Portal.' },
    // Product-level aggregate
    { id: 'DDCR-Z-PROD', productId: 'PROD-APP-Z', requirementId: null, sourceId: null, status: 'NON_COMPLIANT', effectiveAt: now, evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'Customer Portal overall: 2 of 3 applicable requirements non-compliant (NIS2, GDPR).' },
  ]
  ddcrZ.forEach(r => db.insert(ddcrReportingRecords).values(r).run())

  // ── DDCR Reporting Records — PROD-APP-W (Internal Analytics, not assessed) ─
  db.insert(ddcrReportingRecords).values({
    id: 'DDCR-W-001',
    productId: 'PROD-APP-W',
    requirementId: null,
    sourceId: null,
    status: 'NOT_ASSESSED',
    effectiveAt: now,
    evidencePackageId: null,
    reportedAt: now,
    reportedBy: 'system',
    notes: 'Internal Analytics: newly onboarded product, compliance assessment not yet started.',
  }).run()

  // ── DDCR Reporting Records — PROD-APP-V (AI Underwriting, EU AI Act non-compliant) ──
  const ddcrV = [
    // Requirement-level
    { id: 'DDCR-V-DORA-REQ', productId: 'PROD-APP-V', requirementId: 'DORA-BACKUP-001', sourceId: 'REG-DORA', status: 'COMPLIANT', effectiveAt: '2025-03-20', evidencePackageId: null, reportedAt: now, reportedBy: 'IT Risk & Compliance Lead', notes: 'Backup geo-redundancy verified. Hybrid deployment uses geo-redundant storage.' },
    { id: 'DDCR-V-NIS2-REQ', productId: 'PROD-APP-V', requirementId: 'NIS2-SECURITY-001', sourceId: 'REG-NIS2', status: 'COMPLIANT', effectiveAt: '2025-03-20', evidencePackageId: null, reportedAt: now, reportedBy: 'IT Risk & Compliance Lead', notes: 'NIS2 incident handling verified for AI Underwriting Engine.' },
    { id: 'DDCR-V-GDPR-REQ', productId: 'PROD-APP-V', requirementId: 'GDPR-RECORDS-001', sourceId: 'REG-GDPR', status: 'COMPLIANT', effectiveAt: '2025-03-20', evidencePackageId: null, reportedAt: now, reportedBy: 'DPO', notes: 'GDPR Art.30 records complete including AI automated decision-making documentation.' },
    { id: 'DDCR-V-EUAIA-REQ', productId: 'PROD-APP-V', requirementId: 'EUAIA-INVENTORY-001', sourceId: 'REG-EUAIA', status: 'NON_COMPLIANT', effectiveAt: '2025-04-01', evidencePackageId: null, reportedAt: now, reportedBy: 'AI Governance Lead', notes: 'High-risk AI system not registered in EU AI database. Registration required before continued operation.' },
    // Regulation-level aggregates
    { id: 'DDCR-V-DORA', productId: 'PROD-APP-V', requirementId: null, sourceId: 'REG-DORA', status: 'COMPLIANT', effectiveAt: now, evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'DORA overall: 1 of 1 applicable requirement compliant.' },
    { id: 'DDCR-V-NIS2', productId: 'PROD-APP-V', requirementId: null, sourceId: 'REG-NIS2', status: 'COMPLIANT', effectiveAt: now, evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'NIS2 overall: 1 of 1 applicable requirement compliant.' },
    { id: 'DDCR-V-GDPR', productId: 'PROD-APP-V', requirementId: null, sourceId: 'REG-GDPR', status: 'COMPLIANT', effectiveAt: now, evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'GDPR overall: 1 of 1 applicable requirement compliant.' },
    { id: 'DDCR-V-EUAIA', productId: 'PROD-APP-V', requirementId: null, sourceId: 'REG-EUAIA', status: 'NON_COMPLIANT', effectiveAt: now, evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'EU AI Act overall: 1 of 1 applicable requirement non-compliant — EU AI database registration missing.' },
    // Product-level aggregate
    { id: 'DDCR-V-PROD', productId: 'PROD-APP-V', requirementId: null, sourceId: null, status: 'NON_COMPLIANT', effectiveAt: now, evidencePackageId: null, reportedAt: now, reportedBy: 'system', notes: 'AI Underwriting Engine overall: 1 of 4 applicable requirements non-compliant (EU AI Act).' },
  ]
  ddcrV.forEach(r => db.insert(ddcrReportingRecords).values(r).run())

  // ── DDCR Federated Cockpit Items ───────────────────────────────────────────

  const ddcrItemsData = [
    // ── Source: PRODUCT_HUB ────────────────────────────────────────────────
    {
      id: 'DDCR-PH-001',
      entityType: 'APPLICATION', entityId: 'PROD-APP-X', entityName: 'IT Application X',
      tower: 'IT Operations', orgUnit: null, section: null, program: null,
      responsibleRole: 'IT Product Manager', actionOwner: 'Sarah Chen',
      regulatoryFramework: 'DORA', requirementRef: 'Art. 12 §2', requirementTitle: 'Geo-redundant backup',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'ACTION_REQUIRED', verificationStatus: 'NOT_STARTED', reportingStatus: 'NON_COMPLIANT',
      nextAction: 'Complete backup geo-redundancy configuration in Product Hub',
      practicalGuidance: 'Navigate to Product Hub → IT Application X → Work Products to update backup configuration documentation.',
      dueDate: '2026-09-15',
      sourceSystem: 'PRODUCT_HUB', sourceSystemUrl: '/product-hub/products/PROD-APP-X', sourceSystemRef: 'PH-WP-001',
      evidenceReferences: '[]',
    },
    {
      id: 'DDCR-PH-002',
      entityType: 'APPLICATION', entityId: 'PROD-APP-X', entityName: 'IT Application X',
      tower: 'IT Operations', orgUnit: null, section: null, program: null,
      responsibleRole: 'IT Product Manager', actionOwner: 'Sarah Chen',
      regulatoryFramework: 'NIS2', requirementRef: 'Art. 21 §2d', requirementTitle: 'Supply chain security controls',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'IN_PROGRESS', verificationStatus: 'PENDING', reportingStatus: 'PARTIALLY_COMPLIANT',
      nextAction: 'Submit supplier security assessment results',
      practicalGuidance: 'Navigate to Product Hub → IT Application X → Gaps to review outstanding supplier assessment gap.',
      dueDate: '2026-09-30',
      sourceSystem: 'PRODUCT_HUB', sourceSystemUrl: '/product-hub/products/PROD-APP-X', sourceSystemRef: 'PH-GAP-003',
      evidenceReferences: '[]',
    },
    {
      id: 'DDCR-PH-003',
      entityType: 'APPLICATION', entityId: 'PROD-APP-X', entityName: 'IT Application X',
      tower: 'IT Operations', orgUnit: null, section: null, program: null,
      responsibleRole: 'IT Product Manager', actionOwner: 'Sarah Chen',
      regulatoryFramework: 'GDPR', requirementRef: 'Art. 32 §1', requirementTitle: 'Technical security measures',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'COMPLETED', verificationStatus: 'PASSED', reportingStatus: 'COMPLIANT',
      nextAction: null,
      practicalGuidance: 'All required security documentation is complete and verified.',
      dueDate: null,
      sourceSystem: 'PRODUCT_HUB', sourceSystemUrl: '/product-hub/products/PROD-APP-X', sourceSystemRef: null,
      evidenceReferences: '[{"id":"EP-001","label":"Security Measures Evidence Package","type":"EVIDENCE_PACKAGE","url":"/evidence-centre"}]',
    },
    {
      id: 'DDCR-PH-004',
      entityType: 'APPLICATION', entityId: 'PROD-APP-Y', entityName: 'Data Analytics Platform',
      tower: 'Data & AI', orgUnit: null, section: null, program: null,
      responsibleRole: 'IT Product Manager', actionOwner: 'Marcus Webb',
      regulatoryFramework: 'DORA', requirementRef: 'Art. 12 §2', requirementTitle: 'Backup resilience',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'OVERDUE', verificationStatus: 'NOT_STARTED', reportingStatus: 'NON_COMPLIANT',
      nextAction: 'Overdue: complete resilience testing — escalate to Tower Lead',
      practicalGuidance: 'This item is overdue. Navigate to Product Hub → Data Analytics Platform to action the outstanding work products.',
      dueDate: '2026-07-31',
      sourceSystem: 'PRODUCT_HUB', sourceSystemUrl: '/product-hub/products/PROD-APP-Y', sourceSystemRef: 'PH-WP-004',
      evidenceReferences: '[]',
    },
    {
      id: 'DDCR-PH-005',
      entityType: 'APPLICATION', entityId: 'PROD-APP-Y', entityName: 'Data Analytics Platform',
      tower: 'Data & AI', orgUnit: null, section: null, program: null,
      responsibleRole: 'IT Product Manager', actionOwner: 'Marcus Webb',
      regulatoryFramework: 'NIS2', requirementRef: 'Art. 23 §1', requirementTitle: 'Incident reporting obligations',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'IN_PROGRESS', verificationStatus: 'PENDING', reportingStatus: 'PARTIALLY_COMPLIANT',
      nextAction: 'Finalise incident reporting procedure document',
      practicalGuidance: 'Navigate to Product Hub → Data Analytics Platform to complete the incident reporting work product.',
      dueDate: '2026-10-01',
      sourceSystem: 'PRODUCT_HUB', sourceSystemUrl: '/product-hub/products/PROD-APP-Y', sourceSystemRef: 'PH-WP-007',
      evidenceReferences: '[]',
    },
    {
      id: 'DDCR-PH-006',
      entityType: 'APPLICATION', entityId: 'PROD-APP-Z', entityName: 'Customer Portal',
      tower: 'Digital Products', orgUnit: null, section: null, program: null,
      responsibleRole: 'IT Product Manager', actionOwner: 'Lena Fischer',
      regulatoryFramework: 'GDPR', requirementRef: 'Art. 30 §1', requirementTitle: 'Records of processing activities',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'COMPLETED', verificationStatus: 'PASSED', reportingStatus: 'COMPLIANT',
      nextAction: null,
      practicalGuidance: null,
      dueDate: null,
      sourceSystem: 'PRODUCT_HUB', sourceSystemUrl: '/product-hub/products/PROD-APP-Z', sourceSystemRef: null,
      evidenceReferences: '[{"id":"EP-003","label":"ROPA Evidence Package","type":"EVIDENCE_PACKAGE"}]',
    },
    {
      id: 'DDCR-PH-007',
      entityType: 'APPLICATION', entityId: 'PROD-APP-V', entityName: 'AI Underwriting Engine',
      tower: 'Data & AI', orgUnit: null, section: null, program: null,
      responsibleRole: 'IT Product Manager', actionOwner: 'Marcus Webb',
      regulatoryFramework: 'DORA', requirementRef: 'Art. 17 §1', requirementTitle: 'ICT risk management framework',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'ACTION_REQUIRED', verificationStatus: 'NOT_STARTED', reportingStatus: 'NON_COMPLIANT',
      nextAction: 'Create ICT risk management framework documentation',
      practicalGuidance: 'Navigate to Product Hub → AI Underwriting Engine to complete the ICT risk management work product.',
      dueDate: '2026-09-20',
      sourceSystem: 'PRODUCT_HUB', sourceSystemUrl: '/product-hub/products/PROD-APP-V', sourceSystemRef: 'PH-WP-010',
      evidenceReferences: '[]',
    },
    {
      id: 'DDCR-PH-008',
      entityType: 'APPLICATION', entityId: 'PROD-APP-V', entityName: 'AI Underwriting Engine',
      tower: 'Data & AI', orgUnit: null, section: null, program: null,
      responsibleRole: 'IT Product Manager', actionOwner: 'Marcus Webb',
      regulatoryFramework: 'GDPR', requirementRef: 'Art. 25 §1', requirementTitle: 'Data protection by design',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'ACTION_REQUIRED', verificationStatus: 'NOT_STARTED', reportingStatus: 'NON_COMPLIANT',
      nextAction: 'Complete privacy impact assessment',
      practicalGuidance: 'Navigate to Product Hub → AI Underwriting Engine → Gaps to review outstanding DPIA gap.',
      dueDate: '2026-09-30',
      sourceSystem: 'PRODUCT_HUB', sourceSystemUrl: '/product-hub/products/PROD-APP-V', sourceSystemRef: null,
      evidenceReferences: '[]',
    },
    // ── Source: SERVICENOW ─────────────────────────────────────────────────
    {
      id: 'DDCR-SN-001',
      entityType: 'APPLICATION', entityId: 'PROD-APP-X', entityName: 'IT Application X',
      tower: 'Cybersecurity', orgUnit: null, section: null, program: null,
      responsibleRole: 'Security Engineer', actionOwner: 'Oliver Park',
      regulatoryFramework: 'DORA', requirementRef: 'Art. 9 §4', requirementTitle: 'Vulnerability management',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'OVERDUE', verificationStatus: 'FAILED', reportingStatus: 'NON_COMPLIANT',
      nextAction: 'Remediate CVE-2024-3891 and CVE-2024-4102 — critical vulnerabilities outstanding',
      practicalGuidance: 'Open ServiceNow ticket INC-0042 to track remediation. Coordinate with security team for patch deployment.',
      dueDate: '2026-07-15',
      sourceSystem: 'SERVICENOW', sourceSystemUrl: 'https://servicenow.internal/nav_to.do?uri=incident.do?sys_id=INC0042', sourceSystemRef: 'INC-0042',
      evidenceReferences: '[]',
    },
    {
      id: 'DDCR-SN-002',
      entityType: 'APPLICATION', entityId: 'PROD-APP-Y', entityName: 'Data Analytics Platform',
      tower: 'Cybersecurity', orgUnit: null, section: null, program: null,
      responsibleRole: 'Security Engineer', actionOwner: 'Oliver Park',
      regulatoryFramework: 'NIS2', requirementRef: 'Art. 21 §2a', requirementTitle: 'Patch and vulnerability management',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'IN_PROGRESS', verificationStatus: 'PENDING', reportingStatus: 'PARTIALLY_COMPLIANT',
      nextAction: 'Complete Q3 patch cycle — 3 of 9 patches remaining',
      practicalGuidance: 'Open ServiceNow change request CHG-0234 to complete outstanding patch deployments.',
      dueDate: '2026-09-01',
      sourceSystem: 'SERVICENOW', sourceSystemUrl: 'https://servicenow.internal/nav_to.do?uri=change_request.do?sys_id=CHG0234', sourceSystemRef: 'CHG-0234',
      evidenceReferences: '[]',
    },
    {
      id: 'DDCR-SN-003',
      entityType: 'APPLICATION', entityId: 'PROD-APP-Z', entityName: 'Customer Portal',
      tower: 'Cybersecurity', orgUnit: null, section: null, program: null,
      responsibleRole: 'Security Engineer', actionOwner: 'Oliver Park',
      regulatoryFramework: 'NIS2', requirementRef: 'Art. 23 §1', requirementTitle: 'Incident response capability',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'COMPLETED', verificationStatus: 'PASSED', reportingStatus: 'COMPLIANT',
      nextAction: null,
      practicalGuidance: null,
      dueDate: null,
      sourceSystem: 'SERVICENOW', sourceSystemUrl: 'https://servicenow.internal', sourceSystemRef: 'CHG-0198',
      evidenceReferences: '[{"id":"SN-EVD-001","label":"Incident Response Test Evidence","type":"TEST_RECORD"}]',
    },
    {
      id: 'DDCR-SN-004',
      entityType: 'APPLICATION', entityId: 'PROD-APP-V', entityName: 'AI Underwriting Engine',
      tower: 'Cybersecurity', orgUnit: null, section: null, program: null,
      responsibleRole: 'Security Engineer', actionOwner: 'Oliver Park',
      regulatoryFramework: 'NIS2', requirementRef: 'Art. 21 §2b', requirementTitle: 'Access control and identity management',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'ACTION_REQUIRED', verificationStatus: 'NOT_STARTED', reportingStatus: 'NON_COMPLIANT',
      nextAction: 'Implement MFA for all privileged accounts — raise ServiceNow task',
      practicalGuidance: 'Raise a ServiceNow task for the Identity team. Reference control CTRL-IAM-042.',
      dueDate: '2026-09-15',
      sourceSystem: 'SERVICENOW', sourceSystemUrl: 'https://servicenow.internal', sourceSystemRef: 'CTRL-IAM-042',
      evidenceReferences: '[]',
    },
    // ── Source: PROJECT_MANAGEMENT ─────────────────────────────────────────
    {
      id: 'DDCR-PM-001',
      entityType: 'PROJECT', entityId: 'PROJ-001', entityName: 'DORA Resilience Program',
      tower: 'PMO', orgUnit: null, section: 'Operational Resilience', program: 'Digital Resilience Initiative',
      responsibleRole: 'Program Manager', actionOwner: 'James Hartley',
      regulatoryFramework: 'DORA', requirementRef: 'Art. 11 §1', requirementTitle: 'Business continuity policy',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'IN_PROGRESS', verificationStatus: 'PENDING', reportingStatus: 'PARTIALLY_COMPLIANT',
      nextAction: 'Finalise BCP documentation review — milestone M3 in progress',
      practicalGuidance: 'Update task PRJ-A-1234 in the project management tool. Milestone M3 review is due by end of Q3.',
      dueDate: '2026-10-15',
      sourceSystem: 'PROJECT_MANAGEMENT', sourceSystemUrl: 'https://jira.internal/browse/DORA-101', sourceSystemRef: 'PRJ-A-1234',
      evidenceReferences: '[]',
    },
    {
      id: 'DDCR-PM-002',
      entityType: 'PROJECT', entityId: 'PROJ-001', entityName: 'DORA Resilience Program',
      tower: 'PMO', orgUnit: null, section: 'Operational Resilience', program: 'Digital Resilience Initiative',
      responsibleRole: 'Program Manager', actionOwner: 'James Hartley',
      regulatoryFramework: 'DORA', requirementRef: 'Art. 12 §2', requirementTitle: 'Backup and recovery testing',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'ACTION_REQUIRED', verificationStatus: 'NOT_STARTED', reportingStatus: 'NON_COMPLIANT',
      nextAction: 'Schedule DR test for all in-scope systems',
      practicalGuidance: 'Create task in project management tool under DORA Resilience Program — assign to infrastructure team.',
      dueDate: '2026-09-01',
      sourceSystem: 'PROJECT_MANAGEMENT', sourceSystemUrl: 'https://jira.internal/browse/DORA-102', sourceSystemRef: 'PRJ-A-1235',
      evidenceReferences: '[]',
    },
    {
      id: 'DDCR-PM-003',
      entityType: 'PROJECT', entityId: 'PROJ-002', entityName: 'NIS2 Security Implementation',
      tower: 'Cybersecurity', orgUnit: null, section: 'Cybersecurity', program: 'Regulatory Compliance Programme',
      responsibleRole: 'Project Manager', actionOwner: 'Aiko Tanaka',
      regulatoryFramework: 'NIS2', requirementRef: 'Art. 18 §1', requirementTitle: 'Risk management policies',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'IN_PROGRESS', verificationStatus: 'PENDING', reportingStatus: 'PARTIALLY_COMPLIANT',
      nextAction: 'Complete risk register update for all in-scope systems',
      practicalGuidance: 'Update milestone M2 in the project management tool. Coordinate with Risk team for sign-off.',
      dueDate: '2026-10-31',
      sourceSystem: 'PROJECT_MANAGEMENT', sourceSystemUrl: 'https://jira.internal/browse/NIS2-201', sourceSystemRef: 'PRJ-B-2201',
      evidenceReferences: '[]',
    },
    {
      id: 'DDCR-PM-004',
      entityType: 'PROJECT', entityId: 'PROJ-003', entityName: 'GDPR Data Mapping Initiative',
      tower: 'Data & AI', orgUnit: null, section: 'Data Governance', program: 'Regulatory Compliance Programme',
      responsibleRole: 'Project Manager', actionOwner: 'Reem Al-Hassan',
      regulatoryFramework: 'GDPR', requirementRef: 'Art. 30 §1', requirementTitle: 'Maintain records of processing',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'IN_PROGRESS', verificationStatus: 'PENDING', reportingStatus: 'PARTIALLY_COMPLIANT',
      nextAction: 'Complete ROPA entries for 4 remaining data processing activities',
      practicalGuidance: 'Update project tasks in GDPR Data Mapping project. Coordinate with Data Stewards.',
      dueDate: '2026-11-01',
      sourceSystem: 'PROJECT_MANAGEMENT', sourceSystemUrl: 'https://jira.internal/browse/GDPR-301', sourceSystemRef: 'PRJ-C-3301',
      evidenceReferences: '[]',
    },
    // ── Source: GRC ────────────────────────────────────────────────────────
    {
      id: 'DDCR-GRC-001',
      entityType: 'APPLICATION', entityId: 'PROD-APP-X', entityName: 'IT Application X',
      tower: 'IT Operations', orgUnit: null, section: null, program: null,
      responsibleRole: 'Risk Manager', actionOwner: 'Helena Braun',
      regulatoryFramework: 'DORA', requirementRef: 'Art. 6 §1', requirementTitle: 'ICT risk management framework',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'COMPLETED', verificationStatus: 'PASSED', reportingStatus: 'COMPLIANT',
      nextAction: null,
      practicalGuidance: null,
      dueDate: null,
      sourceSystem: 'GRC', sourceSystemUrl: 'https://grc.internal/risk/PROD-APP-X', sourceSystemRef: 'RA-2024-001',
      evidenceReferences: '[{"id":"RA-2024-001","label":"ICT Risk Assessment 2024","type":"RISK_ASSESSMENT"}]',
    },
    {
      id: 'DDCR-GRC-002',
      entityType: 'APPLICATION', entityId: 'PROD-APP-V', entityName: 'AI Underwriting Engine',
      tower: 'Data & AI', orgUnit: null, section: null, program: null,
      responsibleRole: 'Risk Manager', actionOwner: 'Helena Braun',
      regulatoryFramework: 'DORA', requirementRef: 'Art. 6 §1', requirementTitle: 'ICT risk management framework',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'ACTION_REQUIRED', verificationStatus: 'NOT_STARTED', reportingStatus: 'NON_COMPLIANT',
      nextAction: 'Complete ICT risk assessment for AI Underwriting Engine',
      practicalGuidance: 'Raise a new risk assessment in the GRC platform. Assign to Risk Manager. Template: RA-TEMPLATE-ICT.',
      dueDate: '2026-09-30',
      sourceSystem: 'GRC', sourceSystemUrl: 'https://grc.internal/risk/PROD-APP-V', sourceSystemRef: 'RA-2024-PENDING',
      evidenceReferences: '[]',
    },
    {
      id: 'DDCR-GRC-003',
      entityType: 'PROJECT', entityId: 'PROJ-002', entityName: 'NIS2 Security Implementation',
      tower: 'Cybersecurity', orgUnit: null, section: 'Cybersecurity', program: null,
      responsibleRole: 'Risk Manager', actionOwner: 'Helena Braun',
      regulatoryFramework: 'NIS2', requirementRef: 'Art. 21 §1', requirementTitle: 'Cybersecurity risk measures',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'IN_PROGRESS', verificationStatus: 'PENDING', reportingStatus: 'PARTIALLY_COMPLIANT',
      nextAction: 'Submit control framework attestation for NIS2 risk measures',
      practicalGuidance: 'Update control evidence in GRC platform under NIS2 control framework.',
      dueDate: '2026-10-31',
      sourceSystem: 'GRC', sourceSystemUrl: 'https://grc.internal/controls/NIS2', sourceSystemRef: 'CF-NIS2-001',
      evidenceReferences: '[]',
    },
    // ── Source: LEANIX ─────────────────────────────────────────────────────
    {
      id: 'DDCR-LX-001',
      entityType: 'APPLICATION', entityId: 'PROD-APP-X', entityName: 'IT Application X',
      tower: 'IT Operations', orgUnit: null, section: null, program: null,
      responsibleRole: 'Enterprise Architect', actionOwner: 'Tom Visser',
      regulatoryFramework: 'DORA', requirementRef: 'Art. 5 §1', requirementTitle: 'IT governance and accountability',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'COMPLETED', verificationStatus: 'PASSED', reportingStatus: 'COMPLIANT',
      nextAction: null,
      practicalGuidance: null,
      dueDate: null,
      sourceSystem: 'LEANIX', sourceSystemUrl: 'https://leanix.internal/factsheets/PROD-APP-X', sourceSystemRef: 'LX-APP-X-2024',
      evidenceReferences: '[{"id":"LX-2024","label":"LeanIX Application Factsheet","type":"APPLICATION_RECORD"}]',
    },
    {
      id: 'DDCR-LX-002',
      entityType: 'APPLICATION', entityId: 'PROD-APP-Z', entityName: 'Customer Portal',
      tower: 'Digital Products', orgUnit: null, section: null, program: null,
      responsibleRole: 'Enterprise Architect', actionOwner: 'Tom Visser',
      regulatoryFramework: 'DORA', requirementRef: 'Art. 5 §1', requirementTitle: 'IT governance and accountability',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'ACTION_REQUIRED', verificationStatus: 'NOT_STARTED', reportingStatus: 'PARTIALLY_COMPLIANT',
      nextAction: 'Complete LeanIX application factsheet — missing lifecycle and owner fields',
      practicalGuidance: 'Update the Customer Portal factsheet in LeanIX. Navigate to the application profile and complete all mandatory fields.',
      dueDate: '2026-09-15',
      sourceSystem: 'LEANIX', sourceSystemUrl: 'https://leanix.internal/factsheets/PROD-APP-Z', sourceSystemRef: 'LX-APP-Z-2024',
      evidenceReferences: '[]',
    },
    // ── Source: CODE_SCANNING ──────────────────────────────────────────────
    {
      id: 'DDCR-CS-001',
      entityType: 'APPLICATION', entityId: 'PROD-APP-X', entityName: 'IT Application X',
      tower: 'Cybersecurity', orgUnit: null, section: null, program: null,
      responsibleRole: 'Security Engineer', actionOwner: 'Oliver Park',
      regulatoryFramework: 'NIS2', requirementRef: 'Art. 21 §2g', requirementTitle: 'Secure development practices',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'OVERDUE', verificationStatus: 'FAILED', reportingStatus: 'NON_COMPLIANT',
      nextAction: 'Remediate 4 HIGH severity SAST findings — overdue since July 2026',
      practicalGuidance: 'Review SAST findings in code scanning tool. Findings IDs: CS-H-0041, CS-H-0042, CS-H-0048, CS-H-0051. Coordinate with development team.',
      dueDate: '2026-07-01',
      sourceSystem: 'CODE_SCANNING', sourceSystemUrl: 'https://sonar.internal/dashboard?id=app-x', sourceSystemRef: 'SAST-SCAN-2024-Q2',
      evidenceReferences: '[]',
    },
    {
      id: 'DDCR-CS-002',
      entityType: 'APPLICATION', entityId: 'PROD-APP-Y', entityName: 'Data Analytics Platform',
      tower: 'Data & AI', orgUnit: null, section: null, program: null,
      responsibleRole: 'Security Engineer', actionOwner: 'Oliver Park',
      regulatoryFramework: 'NIS2', requirementRef: 'Art. 21 §2g', requirementTitle: 'Secure development practices',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'IN_PROGRESS', verificationStatus: 'PENDING', reportingStatus: 'PARTIALLY_COMPLIANT',
      nextAction: 'Resolve remaining MEDIUM severity dependency vulnerabilities',
      practicalGuidance: 'Review dependency scan results and raise remediation tasks with the development team.',
      dueDate: '2026-09-01',
      sourceSystem: 'CODE_SCANNING', sourceSystemUrl: 'https://sonar.internal/dashboard?id=app-y', sourceSystemRef: 'DEP-SCAN-2024-Q2',
      evidenceReferences: '[]',
    },
    {
      id: 'DDCR-CS-003',
      entityType: 'APPLICATION', entityId: 'PROD-APP-V', entityName: 'AI Underwriting Engine',
      tower: 'Data & AI', orgUnit: null, section: null, program: null,
      responsibleRole: 'Security Engineer', actionOwner: 'Oliver Park',
      regulatoryFramework: 'NIS2', requirementRef: 'Art. 21 §2g', requirementTitle: 'Secure development practices',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'ACTION_REQUIRED', verificationStatus: 'NOT_STARTED', reportingStatus: 'NON_COMPLIANT',
      nextAction: 'Run initial security scan — no baseline established yet',
      practicalGuidance: 'Trigger first SAST scan in code scanning tool for AI Underwriting Engine codebase.',
      dueDate: '2026-09-15',
      sourceSystem: 'CODE_SCANNING', sourceSystemUrl: 'https://sonar.internal/dashboard?id=app-v', sourceSystemRef: null,
      evidenceReferences: '[]',
    },
    {
      id: 'DDCR-CS-004',
      entityType: 'APPLICATION', entityId: 'PROD-APP-Z', entityName: 'Customer Portal',
      tower: 'Digital Products', orgUnit: null, section: null, program: null,
      responsibleRole: 'Security Engineer', actionOwner: 'Oliver Park',
      regulatoryFramework: 'NIS2', requirementRef: 'Art. 21 §2g', requirementTitle: 'Secure development practices',
      applicabilityStatus: 'APPLICABLE', applicabilityRationale: null,
      executionStatus: 'COMPLETED', verificationStatus: 'PASSED', reportingStatus: 'COMPLIANT',
      nextAction: null,
      practicalGuidance: null,
      dueDate: null,
      sourceSystem: 'CODE_SCANNING', sourceSystemUrl: 'https://sonar.internal/dashboard?id=app-z', sourceSystemRef: 'SAST-SCAN-2024-Q2',
      evidenceReferences: '[{"id":"SAST-Q2-Z","label":"Clean SAST Scan Report Q2 2026","type":"SCAN_REPORT"}]',
    },
  ]

  ddcrItemsData.forEach(item => {
    db.insert(ddcrItems).values(item).run()
  })

  // ── DDCR Item History ──────────────────────────────────────────────────────

  const ddcrHistoryData = [
    { id: 'DHIST-001', itemId: 'DDCR-PH-004', changedAt: '2026-05-01', changedBy: 'system', sourceSystem: 'PRODUCT_HUB', previousReportingStatus: 'NON_COMPLIANT', newReportingStatus: 'NON_COMPLIANT', previousExecutionStatus: 'ACTION_REQUIRED', newExecutionStatus: 'OVERDUE', changeReason: 'Item exceeded due date of 2026-07-31 without completion' },
    { id: 'DHIST-002', itemId: 'DDCR-PH-002', changedAt: '2026-04-15', changedBy: 'ProductHub', sourceSystem: 'PRODUCT_HUB', previousReportingStatus: 'NON_COMPLIANT', newReportingStatus: 'PARTIALLY_COMPLIANT', previousExecutionStatus: 'ACTION_REQUIRED', newExecutionStatus: 'IN_PROGRESS', changeReason: 'Supplier security assessment initiated — 40% complete' },
    { id: 'DHIST-003', itemId: 'DDCR-PH-003', changedAt: '2026-06-01', changedBy: 'ProductHub', sourceSystem: 'PRODUCT_HUB', previousReportingStatus: 'PARTIALLY_COMPLIANT', newReportingStatus: 'COMPLIANT', previousExecutionStatus: 'IN_PROGRESS', newExecutionStatus: 'COMPLETED', changeReason: 'All security documentation verified and evidence package assembled' },
    { id: 'DHIST-004', itemId: 'DDCR-SN-001', changedAt: '2026-06-15', changedBy: 'ServiceNow', sourceSystem: 'SERVICENOW', previousReportingStatus: 'NON_COMPLIANT', newReportingStatus: 'NON_COMPLIANT', previousExecutionStatus: 'ACTION_REQUIRED', newExecutionStatus: 'OVERDUE', changeReason: 'CVE remediation SLA breached — ticket INC-0042 escalated' },
    { id: 'DHIST-005', itemId: 'DDCR-SN-003', changedAt: '2026-07-01', changedBy: 'ServiceNow', sourceSystem: 'SERVICENOW', previousReportingStatus: 'PARTIALLY_COMPLIANT', newReportingStatus: 'COMPLIANT', previousExecutionStatus: 'IN_PROGRESS', newExecutionStatus: 'COMPLETED', changeReason: 'Incident response test completed and evidence recorded in ServiceNow' },
    { id: 'DHIST-006', itemId: 'DDCR-CS-001', changedAt: '2026-07-05', changedBy: 'CodeScanning', sourceSystem: 'CODE_SCANNING', previousReportingStatus: 'NON_COMPLIANT', newReportingStatus: 'NON_COMPLIANT', previousExecutionStatus: 'IN_PROGRESS', newExecutionStatus: 'OVERDUE', changeReason: '4 HIGH SAST findings remain unresolved past due date' },
    { id: 'DHIST-007', itemId: 'DDCR-GRC-001', changedAt: '2026-05-20', changedBy: 'GRCPlatform', sourceSystem: 'GRC', previousReportingStatus: 'PARTIALLY_COMPLIANT', newReportingStatus: 'COMPLIANT', previousExecutionStatus: 'IN_PROGRESS', newExecutionStatus: 'COMPLETED', changeReason: 'Risk assessment completed and approved by Risk Committee' },
    { id: 'DHIST-008', itemId: 'DDCR-PH-006', changedAt: '2026-06-30', changedBy: 'ProductHub', sourceSystem: 'PRODUCT_HUB', previousReportingStatus: 'PARTIALLY_COMPLIANT', newReportingStatus: 'COMPLIANT', previousExecutionStatus: 'IN_PROGRESS', newExecutionStatus: 'COMPLETED', changeReason: 'ROPA documentation finalised and verified' },
    { id: 'DHIST-009', itemId: 'DDCR-SN-002', changedAt: '2026-06-01', changedBy: 'ServiceNow', sourceSystem: 'SERVICENOW', previousReportingStatus: 'NON_COMPLIANT', newReportingStatus: 'PARTIALLY_COMPLIANT', previousExecutionStatus: 'ACTION_REQUIRED', newExecutionStatus: 'IN_PROGRESS', changeReason: 'Patch cycle Q3 started — 6 of 9 patches deployed' },
    { id: 'DHIST-010', itemId: 'DDCR-PM-001', changedAt: '2026-05-01', changedBy: 'ProjectManagement', sourceSystem: 'PROJECT_MANAGEMENT', previousReportingStatus: 'NON_COMPLIANT', newReportingStatus: 'PARTIALLY_COMPLIANT', previousExecutionStatus: 'ACTION_REQUIRED', newExecutionStatus: 'IN_PROGRESS', changeReason: 'Milestone M2 completed — BCP framework drafted' },
    { id: 'DHIST-011', itemId: 'DDCR-LX-001', changedAt: '2026-04-10', changedBy: 'LeanIX', sourceSystem: 'LEANIX', previousReportingStatus: 'PARTIALLY_COMPLIANT', newReportingStatus: 'COMPLIANT', previousExecutionStatus: 'IN_PROGRESS', newExecutionStatus: 'COMPLETED', changeReason: 'LeanIX factsheet completed and approved by Enterprise Architecture' },
    { id: 'DHIST-012', itemId: 'DDCR-CS-004', changedAt: '2026-07-15', changedBy: 'CodeScanning', sourceSystem: 'CODE_SCANNING', previousReportingStatus: 'NON_COMPLIANT', newReportingStatus: 'COMPLIANT', previousExecutionStatus: 'IN_PROGRESS', newExecutionStatus: 'COMPLETED', changeReason: 'All SAST findings remediated — clean scan achieved' },
  ]

  ddcrHistoryData.forEach(h => {
    db.insert(ddcrItemHistory).values(h).run()
  })

  console.log('✓ Database seeded successfully')
  console.log('  - 1 regulation source (DORA Article 12) [legacy]')
  console.log('  - 4 requirements [legacy]')
  console.log('  - 1 guideline (v3.2 active, v3.3 proposed)')
  console.log('  - 2 control activities (BR0039, BR0039-GR)')
  console.log('  - 5 applications (IT App X, Trading Platform, Customer Portal, Internal Analytics, AI Underwriting Engine)')
  console.log('  - 5 policy definitions')
  console.log('  - 5 policy evaluations (baseline)')
  console.log('  - 4 compliance work products')
  console.log('  - 2 documents (SDD, Operating Manual)')
  console.log('  - 29 portfolio apps (25 legacy + 4 new)')
  console.log('  - 6 value assumptions')
  console.log('  - 1 demo run (BASELINE state)')
  console.log('  ── Multi-regulation domain model ──')
  console.log('  - 4 regulatory sources (DORA, NIS2, GDPR, EU AI Act)')
  console.log('  - 4 regulatory versions')
  console.log('  - 4 regulatory requirements')
  console.log('  - 5 internal documents')
  console.log('  - 6 requirement → document mappings')
  console.log('  - 2 compliance gaps (DORA backup, NIS2 process)')
  console.log('  - 2 control changes (both approved and published)')
  console.log('  - 5 products (IT App X, Trading Platform, Customer Portal, Internal Analytics, AI Underwriting Engine)')
  console.log('  - 16 product applicability records')
  console.log('  - 6 product gaps (3×PROD-X, 2×PROD-Z, 1×PROD-V)')
  console.log('  - 3 remediation cases')
  console.log('  - 6 work product definitions')
  console.log('  - 5 product work products')
  console.log('  - 4 verification criteria')
  console.log('  - 5 verification results (GDPR×PROD-X, DORA/NIS2/GDPR×PROD-Y, DORA×PROD-Z)')
  console.log('  - 5 evidence packages (GDPR×PROD-X, DORA/NIS2/GDPR×PROD-Y, DORA×PROD-Z)')
  console.log('  - 16 requirement status history entries')
  console.log('  - 37 DDCR reporting records (requirement + regulation + product level × 5 products)')
}

seed()
