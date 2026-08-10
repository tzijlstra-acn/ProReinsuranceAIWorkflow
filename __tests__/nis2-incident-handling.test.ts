import { describe, it, expect, beforeEach } from 'vitest'
import { db, sqlite } from '@/lib/db/index'
import {
  regulatorySources,
  regulatoryVersions,
  regulatoryRequirements,
  products,
  productApplicability,
  productGaps,
  verificationCriteria,
  verificationResults,
  evidencePackages,
  ddcrReportingRecords,
} from '@/lib/db/schema'
import {
  getProductGaps,
  getProductComplianceSummary,
  updateProductGapStatus,
} from '@/lib/domain/product-hub'
import {
  checkDDCRTransitionAllowed,
  transitionToCompliant,
} from '@/lib/domain/ddcr/status-engine'
import { eq, and } from 'drizzle-orm'

const NOW = new Date().toISOString()

const CLEAR_SQL = `
  DELETE FROM ddcr_reporting_records;
  DELETE FROM requirement_status_history;
  DELETE FROM evidence_packages;
  DELETE FROM verification_results;
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
`

describe('NIS2 Art. 21(2)(b) — Incident Handling Workflow', () => {
  beforeEach(() => {
    sqlite.exec(CLEAR_SQL)

    db.insert(regulatorySources).values({
      id: 'SRC-NIS2',
      shortCode: 'NIS2',
      name: 'Network and Information Security Directive 2',
      jurisdiction: 'EU',
      status: 'active',
      createdAt: NOW,
    }).run()

    db.insert(regulatoryVersions).values({
      id: 'VER-NIS2-2022',
      sourceId: 'SRC-NIS2',
      version: '2022/2555',
      publishedAt: '2022-12-27',
      changeType: 'initial',
      isActive: true,
      createdAt: NOW,
    }).run()

    db.insert(regulatoryRequirements).values({
      id: 'REQ-NIS2-IH',
      sourceId: 'SRC-NIS2',
      versionId: 'VER-NIS2-2022',
      articleRef: 'Art. 21(2)(b)',
      title: 'Incident handling and post-incident review',
      description: 'Essential entities shall implement policies and procedures on incident handling including detection, analysis, containment, recovery and post-incident review.',
      obligationType: 'PROCESS',
      obligationLevel: 'MANDATORY',
      status: 'active',
      createdAt: NOW,
    }).run()

    db.insert(products).values({
      id: 'PROD-IH-TEST',
      name: 'Incident Handling Test App',
      type: 'IT_APPLICATION',
      criticality: 'HIGH',
      owner: 'IT Risk & Compliance',
      status: 'active',
    }).run()

    db.insert(productApplicability).values({
      id: 'PA-IH-TEST',
      productId: 'PROD-IH-TEST',
      requirementId: 'REQ-NIS2-IH',
      sourceId: 'SRC-NIS2',
      applicable: true,
      applicabilityReason: 'HIGH criticality application operated by an essential entity under NIS2.',
      assessedAt: NOW,
      assessedBy: 'system',
    }).run()
  })

  describe('gap identification', () => {
    it('detects an open gap when post-incident review procedure is missing', () => {
      db.insert(productGaps).values({
        id: 'PG-IH-001',
        productId: 'PROD-IH-TEST',
        requirementId: 'REQ-NIS2-IH',
        controlChangeId: null,
        title: 'No post-incident review procedure documented',
        description: 'NIS2 Art.21(2)(b) requires a formal post-incident review section. Current procedure lacks this section.',
        gapType: 'PROCESS',
        severity: 'HIGH',
        status: 'OPEN',
        detectedAt: NOW,
        resolvedAt: null,
      }).run()

      const gaps = getProductGaps('PROD-IH-TEST', 'REQ-NIS2-IH')
      expect(gaps).toHaveLength(1)
      expect(gaps[0].status).toBe('OPEN')
      expect(gaps[0].gapType).toBe('PROCESS')
      expect(gaps[0].severity).toBe('HIGH')
    })

    it('compliance summary reflects the open gap', () => {
      db.insert(productGaps).values({
        id: 'PG-IH-002',
        productId: 'PROD-IH-TEST',
        requirementId: 'REQ-NIS2-IH',
        controlChangeId: null,
        title: 'No post-incident review procedure',
        description: 'Missing post-incident review section.',
        gapType: 'PROCESS',
        severity: 'HIGH',
        status: 'OPEN',
        detectedAt: NOW,
        resolvedAt: null,
      }).run()

      const summary = getProductComplianceSummary('PROD-IH-TEST')
      const nis2Entry = summary.find(s => s.applicability.requirementId === 'REQ-NIS2-IH')
      expect(nis2Entry).toBeDefined()
      expect(nis2Entry!.openGaps.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('gap remediation lifecycle', () => {
    beforeEach(() => {
      db.insert(productGaps).values({
        id: 'PG-IH-REM',
        productId: 'PROD-IH-TEST',
        requirementId: 'REQ-NIS2-IH',
        controlChangeId: null,
        title: 'Post-incident review procedure gap',
        description: 'Incident procedure v1.4 lacks post-incident review section.',
        gapType: 'PROCESS',
        severity: 'HIGH',
        status: 'OPEN',
        detectedAt: NOW,
        resolvedAt: null,
      }).run()
    })

    it('gap transitions through IN_REMEDIATION then RESOLVED', () => {
      updateProductGapStatus('PG-IH-REM', 'IN_REMEDIATION')
      const midway = getProductGaps('PROD-IH-TEST', 'REQ-NIS2-IH')
      expect(midway[0].status).toBe('IN_REMEDIATION')

      updateProductGapStatus('PG-IH-REM', 'RESOLVED')
      const resolved = getProductGaps('PROD-IH-TEST', 'REQ-NIS2-IH')
      expect(resolved[0].status).toBe('RESOLVED')
    })
  })

  describe('DDCR transition gate', () => {
    it('blocks transition when no COMPLETE evidence package exists', () => {
      const check = checkDDCRTransitionAllowed('PROD-IH-TEST', 'REQ-NIS2-IH')
      expect(check.allowed).toBe(false)
      expect(check.blockers.length).toBeGreaterThan(0)
    })

    it('blocks transition when mandatory verification criterion is not passed', () => {
      db.insert(verificationCriteria).values({
        id: 'VC-IH-TEST',
        requirementId: 'REQ-NIS2-IH',
        title: 'Post-incident review record completed and approved',
        description: 'At least one post-incident review must be completed using the approved template.',
        verifierType: 'WORKFLOW_EVIDENCE',
        isMandatory: true,
        expectedValue: JSON.stringify({ status: 'FULFILLED' }),
        policyCode: null,
      }).run()

      db.insert(evidencePackages).values({
        id: 'EP-IH-INCOMPLETE',
        productId: 'PROD-IH-TEST',
        requirementId: 'REQ-NIS2-IH',
        status: 'COMPLETE',
        assembledAt: NOW,
        approvedAt: NOW,
        approvedBy: 'IT Risk & Compliance Lead',
        verificationResultIds: JSON.stringify([]),
      }).run()

      const check = checkDDCRTransitionAllowed('PROD-IH-TEST', 'REQ-NIS2-IH')
      expect(check.allowed).toBe(false)
      expect(check.blockers.some(b => b.includes('Post-incident review'))).toBe(true)
    })

    it('allows transition when all criteria have PASSED results and evidence package is COMPLETE', () => {
      db.insert(verificationCriteria).values({
        id: 'VC-IH-PASS',
        requirementId: 'REQ-NIS2-IH',
        title: 'Post-incident review approved',
        description: 'Post-incident review record approved within 72h of incident closure.',
        verifierType: 'DOCUMENT_APPROVAL',
        isMandatory: true,
        expectedValue: JSON.stringify({ status: 'FULFILLED' }),
        policyCode: null,
      }).run()

      db.insert(verificationResults).values({
        id: 'VR-IH-PASS',
        criterionId: 'VC-IH-PASS',
        productId: 'PROD-IH-TEST',
        requirementId: 'REQ-NIS2-IH',
        status: 'PASSED',
        verifiedAt: NOW,
        evidenceReference: 'EP-IH-PASS',
        notes: 'Post-incident review record confirmed complete.',
      }).run()

      db.insert(evidencePackages).values({
        id: 'EP-IH-PASS',
        productId: 'PROD-IH-TEST',
        requirementId: 'REQ-NIS2-IH',
        status: 'COMPLETE',
        assembledAt: NOW,
        approvedAt: NOW,
        approvedBy: 'IT Risk & Compliance Lead',
        verificationResultIds: JSON.stringify(['VR-IH-PASS']),
      }).run()

      const check = checkDDCRTransitionAllowed('PROD-IH-TEST', 'REQ-NIS2-IH')
      expect(check.allowed).toBe(true)
      expect(check.blockers).toHaveLength(0)
    })

    it('writes a COMPLIANT DDCR record after a successful transition', () => {
      db.insert(evidencePackages).values({
        id: 'EP-IH-TRANS',
        productId: 'PROD-IH-TEST',
        requirementId: 'REQ-NIS2-IH',
        status: 'COMPLETE',
        assembledAt: NOW,
        approvedAt: NOW,
        approvedBy: 'IT Risk & Compliance Lead',
        verificationResultIds: JSON.stringify([]),
      }).run()

      const result = transitionToCompliant(
        'PROD-IH-TEST',
        'REQ-NIS2-IH',
        'SRC-NIS2',
        'IT Risk & Compliance Lead'
      )
      expect(result.ok).toBe(true)

      const records = db.select().from(ddcrReportingRecords)
        .where(
          and(
            eq(ddcrReportingRecords.productId, 'PROD-IH-TEST'),
            eq(ddcrReportingRecords.requirementId, 'REQ-NIS2-IH'),
            eq(ddcrReportingRecords.status, 'COMPLIANT')
          )
        )
        .all()

      expect(records).toHaveLength(1)
      expect(records[0].reportedBy).toBe('IT Risk & Compliance Lead')
    })
  })
})
