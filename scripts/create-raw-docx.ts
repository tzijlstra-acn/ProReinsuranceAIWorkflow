/**
 * create-raw-docx.ts
 * Run once to create the baseline raw DOCX fixtures.
 * Usage: npx tsx scripts/create-raw-docx.ts
 */

import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.join(process.cwd())

function ensureDir(p: string) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
}

async function createDoc(outputPath: string, lines: string[]) {
  ensureDir(outputPath)
  const children = lines.map(line => {
    if (!line.trim()) return new Paragraph({ children: [] })
    // Detect title lines (all caps start or known heading patterns)
    if (line.match(/^(System Design Document|Operating Manual|Backup & Restore Guideline)/)) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: line, bold: true })],
      })
    }
    if (line.match(/^\d+\.\s+[A-Z]/)) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: line, bold: true })],
      })
    }
    if (line.match(/^\d+\.\d+\s+/)) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: line, bold: true })],
      })
    }
    if (line.includes('Version') && line.includes('|')) {
      return new Paragraph({
        children: [new TextRun({ text: line, italics: true, size: 20 })],
      })
    }
    return new Paragraph({ children: [new TextRun(line)] })
  })

  const doc = new Document({ sections: [{ children }] })
  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(outputPath, buffer)
  console.log(`Created: ${path.relative(ROOT, outputPath)}`)
}

async function main() {
  // --- Guideline v1 ---
  const guidelineV1Lines = [
    'Backup & Restore Guideline',
    'Version 1.0 | Classification: Internal | Owner: Technology Risk',
    '',
    '1. Purpose and Scope',
    'This guideline defines the minimum requirements for backup configuration and data restoration for all IT systems classified as High or Critical.',
    '',
    '2. Definitions',
    'Recovery Time Objective (RTO): Maximum acceptable downtime.',
    'Recovery Point Objective (RPO): Maximum acceptable data loss period.',
    '',
    '3. Backup Requirements',
    '3.1 Automated Backup Jobs',
    'All systems classified High or Critical must have automated daily backup jobs configured.',
    'Backup retention period: minimum 30 days for operational data.',
    '',
    '3.2 Backup Storage',
    'Backup data shall be stored in Azure Blob Storage.',
    'Storage configuration: Locally Redundant Storage (LRS).',
    'Note: Geographic replication is not currently required under this guideline.',
    '',
    '4. Testing Requirements',
    'Backup and restoration procedures shall be tested annually.',
    '',
    '5. Exception Handling',
    'Exceptions to this guideline require approval from the Head of Technology Risk.',
  ]

  await createDoc(
    path.join(ROOT, 'data/raw/guidelines/Backup_Restore_Guideline_v1.docx'),
    guidelineV1Lines,
  )

  // --- SDD v1 ---
  const sddV1Lines = [
    'System Design Document — IT App X',
    'Version 1.4 | Status: Approved | Last Reviewed: Q3 2024',
    '',
    '1. System Overview',
    'IT App X supports the Claims Processing business service.',
    'Criticality: High | Environment: Azure OneCloud',
    '',
    '2. Architecture',
    '[Standard Azure IaaS deployment with single VM and storage account]',
    '',
    '3. Data Classification',
    'Operational claims data: Confidential',
    'Historical records: Internal',
    '',
    '4. Availability Requirements',
    'RTO: 4 hours | RPO: 1 hour',
    '',
    '5. Backup & Recovery',
    'Backup mechanism: Azure Blob Storage automated backup job.',
    'Backup schedule: Daily at 02:00 UTC.',
    'Retention: 30 days.',
    'Storage redundancy: Locally Redundant Storage (LRS).',
    'Geographic replication: Not configured.',
    'Recovery procedure: Restore from Azure Blob Storage snapshot.',
    'Last tested: Q3 2024.',
    '',
    '[PLACEHOLDER — Section 5 to be updated following DORA Article 12 gap remediation]',
  ]

  await createDoc(
    path.join(ROOT, 'data/raw/product-hub/IT_App_X_SDD_v1.docx'),
    sddV1Lines,
  )

  // --- Operating Manual v1 ---
  const omV1Lines = [
    'Operating Manual — IT App X',
    'Version 1.1 | Status: Approved | Last Reviewed: Q3 2024',
    '',
    '1. Daily Operations',
    '1.1 Monitoring: Azure Monitor alerts configured for VM health and storage.',
    '1.2 Backup verification: Daily job log reviewed by Platform team.',
    '',
    '2. Backup Procedures',
    '2.1 Backup Job',
    'Schedule: Daily at 02:00 UTC (automated).',
    'Storage: Azure Blob Storage, locally redundant.',
    'Retention: 30 days rolling.',
    '',
    '2.2 Restore Procedure',
    '1. Log into Azure Portal.',
    '2. Navigate to Storage Account st-app-x-001.',
    '3. Select backup snapshot by date.',
    '4. Initiate restore to VM vm-app-x-001.',
    '',
    '2.3 Geographic Replication',
    'No geographic replication is currently configured.',
    'All backup data resides in primary Azure region (West Europe).',
    '',
    '3. Incident Response',
    '[Standard incident response procedures]',
  ]

  await createDoc(
    path.join(ROOT, 'data/raw/product-hub/IT_App_X_Operating_Manual_v1.docx'),
    omV1Lines,
  )

  console.log('\nAll raw DOCX files created successfully.')
}

main().catch(err => {
  console.error('Error creating DOCX files:', err)
  process.exit(1)
})
