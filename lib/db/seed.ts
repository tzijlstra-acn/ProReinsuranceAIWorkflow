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

  console.log('✓ Database seeded successfully')
  console.log('  - 1 regulation source (DORA Article 12)')
  console.log('  - 4 requirements')
  console.log('  - 1 guideline (v3.2 active, v3.3 proposed)')
  console.log('  - 2 control activities (BR0039, BR0039-GR)')
  console.log('  - 1 application (IT App X)')
  console.log('  - 5 policy definitions')
  console.log('  - 5 policy evaluations (baseline)')
  console.log('  - 4 compliance work products')
  console.log('  - 2 documents (SDD, Operating Manual)')
  console.log('  - 25 portfolio apps')
  console.log('  - 6 value assumptions')
  console.log('  - 1 demo run (BASELINE state)')
}

seed()
