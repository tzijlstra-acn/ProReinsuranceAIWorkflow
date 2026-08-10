import { describe, it, expect, beforeEach } from 'vitest'
import { db, sqlite } from '@/lib/db/index'
import {
  products,
  regulatorySources,
  regulatoryRequirements,
  verificationCriteria,
  ddcrReportingRecords,
  evidencePackages,
  verificationResults,
  productGaps,
  productApplicability,
  controlChanges,
} from '@/lib/db/schema'
import {
  getProductRequirementStatuses,
  getProductOverallStatus,
  checkDDCRTransitionAllowed,
  transitionToCompliant,
  recomputeAggregates,
} from '@/lib/domain/ddcr/status-engine'
import { randomUUID } from 'crypto'

// Use a timestamp in the past so any new inserts during the test are definitively newer
const PAST = new Date(Date.now() - 60_000).toISOString()
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

describe('DDCR Status Engine', () => {
  beforeEach(() => {
    sqlite.exec(CLEAR_SQL)

    db.insert(regulatorySources).values({
      id: 'SRC-DDCR',
      shortCode: 'DORA',
      name: 'Digital Operational Resilience Act',
      jurisdiction: 'EU',
      status: 'active',
    }).run()

    db.insert(regulatoryRequirements).values({
      id: 'REQ-DDCR',
      sourceId: 'SRC-DDCR',
      versionId: 'REGV-DDCR',
      articleRef: 'Art. 12(1)',
      title: 'Backup Requirement',
      description: 'Must maintain backups',
      obligationType: 'TECHNICAL_CONTROL',
      obligationLevel: 'MANDATORY',
      status: 'active',
    }).run()

    db.insert(products).values({
      id: 'PROD-DDCR',
      name: 'DDCR Test Product',
      type: 'IT_APPLICATION',
      criticality: 'HIGH',
    }).run()

    db.insert(verificationCriteria).values({
      id: 'VC-DDCR',
      requirementId: 'REQ-DDCR',
      title: 'Backup Configuration Check',
      verifierType: 'MANUAL_ASSESSMENT',
      isMandatory: true,
    }).run()

    // Requirement-level DDCR record (NON_COMPLIANT) — seeded in the past so any
    // new records inserted during tests will have a strictly later reportedAt.
    db.insert(ddcrReportingRecords).values({
      id: 'DDCR-REC-001',
      productId: 'PROD-DDCR',
      requirementId: 'REQ-DDCR',
      sourceId: 'SRC-DDCR',
      status: 'NON_COMPLIANT',
      effectiveAt: PAST,
      reportedAt: PAST,
    }).run()

    // Open product gap — contributes a blocker to checkDDCRTransitionAllowed
    db.insert(productGaps).values({
      id: 'PG-DDCR',
      productId: 'PROD-DDCR',
      requirementId: 'REQ-DDCR',
      title: 'Open Gap',
      description: 'An unresolved gap',
      gapType: 'CONFIGURATION',
      severity: 'HIGH',
      status: 'OPEN',
      detectedAt: PAST,
    }).run()

    // Applicability record needed by recomputeAggregates
    db.insert(productApplicability).values({
      id: randomUUID(),
      productId: 'PROD-DDCR',
      requirementId: 'REQ-DDCR',
      sourceId: 'SRC-DDCR',
      applicable: true,
      assessedAt: PAST,
    }).run()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Read functions
  // ──────────────────────────────────────────────────────────────────────────

  describe('getProductRequirementStatuses', () => {
    it('returns the NON_COMPLIANT requirement-level record for the product', () => {
      const statuses = getProductRequirementStatuses('PROD-DDCR')
      expect(statuses).toHaveLength(1)
      expect(statuses[0].status).toBe('NON_COMPLIANT')
      expect(statuses[0].requirementId).toBe('REQ-DDCR')
      expect(statuses[0].productId).toBe('PROD-DDCR')
    })

    it('returns empty array for a product with no DDCR records', () => {
      expect(getProductRequirementStatuses('NO-SUCH-PRODUCT')).toHaveLength(0)
    })
  })

  describe('getProductOverallStatus', () => {
    it('returns null when no product-level aggregate record exists', () => {
      // Only requirement-level records are seeded; no record with requirementId=null
      expect(getProductOverallStatus('PROD-DDCR')).toBeNull()
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Evidence gate
  // ──────────────────────────────────────────────────────────────────────────

  describe('checkDDCRTransitionAllowed', () => {
    it('returns allowed=false with blockers when evidence gate fails', () => {
      const result = checkDDCRTransitionAllowed('PROD-DDCR', 'REQ-DDCR')

      expect(result.allowed).toBe(false)
      expect(result.blockers.length).toBeGreaterThan(0)

      const combined = result.blockers.join('\n')
      expect(combined).toMatch(/evidence package/i)
      expect(combined).toContain('Backup Configuration Check')
      expect(combined).toContain('Open Gap')
    })

    it('returns allowed=true when all evidence gates pass', () => {
      // Gate 3: resolve the open gap
      sqlite.exec(`UPDATE product_gaps SET status = 'RESOLVED' WHERE id = 'PG-DDCR'`)

      // Gate 1: a COMPLETE evidence package
      db.insert(evidencePackages).values({
        id: 'EP-DDCR',
        productId: 'PROD-DDCR',
        requirementId: 'REQ-DDCR',
        status: 'COMPLETE',
      }).run()

      // Gate 2: a PASSED result for the mandatory criterion
      db.insert(verificationResults).values({
        id: randomUUID(),
        criterionId: 'VC-DDCR',
        productId: 'PROD-DDCR',
        requirementId: 'REQ-DDCR',
        status: 'PASSED',
        verifiedAt: NOW,
      }).run()

      // Gate 4: a PUBLISHED control change for the requirement
      db.insert(controlChanges).values({
        id: 'CC-DDCR',
        gapId: 'PG-DDCR',
        requirementId: 'REQ-DDCR',
        title: 'Backup Policy Update',
        description: 'Updated backup policy to meet requirement',
        changeType: 'AMEND_POLICY',
        status: 'PUBLISHED',
      }).run()

      const result = checkDDCRTransitionAllowed('PROD-DDCR', 'REQ-DDCR')
      expect(result.allowed).toBe(true)
      expect(result.blockers).toHaveLength(0)
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Transition
  // ──────────────────────────────────────────────────────────────────────────

  describe('transitionToCompliant', () => {
    it('returns ok=false with blockers when the evidence gate is not satisfied', () => {
      const result = transitionToCompliant('PROD-DDCR', 'REQ-DDCR', 'SRC-DDCR', 'tester')
      expect(result.ok).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.blockers).toBeDefined()
      expect(result.blockers!.length).toBeGreaterThan(0)
    })

    it('inserts a new COMPLIANT record and returns ok=true when all gates pass', () => {
      // Make all gates pass
      sqlite.exec(`UPDATE product_gaps SET status = 'RESOLVED' WHERE id = 'PG-DDCR'`)

      db.insert(evidencePackages).values({
        id: 'EP-DDCR-T',
        productId: 'PROD-DDCR',
        requirementId: 'REQ-DDCR',
        status: 'COMPLETE',
      }).run()

      db.insert(verificationResults).values({
        id: randomUUID(),
        criterionId: 'VC-DDCR',
        productId: 'PROD-DDCR',
        requirementId: 'REQ-DDCR',
        status: 'PASSED',
        verifiedAt: NOW,
      }).run()

      const result = transitionToCompliant('PROD-DDCR', 'REQ-DDCR', 'SRC-DDCR', 'tester')
      expect(result.ok).toBe(true)
      expect(result.error).toBeUndefined()

      // The latest record for REQ-DDCR should now be COMPLIANT (inserted after PAST)
      const statuses = getProductRequirementStatuses('PROD-DDCR')
      const compliant = statuses.find(s => s.status === 'COMPLIANT')
      expect(compliant).toBeDefined()
      expect(compliant!.requirementId).toBe('REQ-DDCR')
      expect(compliant!.reportedBy).toBe('tester')
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Aggregate recompute
  // ──────────────────────────────────────────────────────────────────────────

  describe('recomputeAggregates', () => {
    it('removes stale aggregate rows and inserts fresh regulation and product level rows', () => {
      // Insert a stale product-level aggregate row (requirementId = null marks it as aggregate)
      db.insert(ddcrReportingRecords).values({
        id: 'STALE-AGG',
        productId: 'PROD-DDCR',
        requirementId: null,
        sourceId: null,
        status: 'PENDING',
        effectiveAt: PAST,
        reportedAt: PAST,
        reportedBy: 'system',
      }).run()

      recomputeAggregates('PROD-DDCR')

      // Re-read all records for this product after recompute
      const allRecords = db.select().from(ddcrReportingRecords).all()
        .filter(r => r.productId === 'PROD-DDCR')

      // Stale row must have been deleted
      expect(allRecords.find(r => r.id === 'STALE-AGG')).toBeUndefined()

      // Product-level aggregate should be present and NON_COMPLIANT
      // (REQ-DDCR is NON_COMPLIANT → SRC-DDCR is NON_COMPLIANT → product is NON_COMPLIANT)
      const productOverall = getProductOverallStatus('PROD-DDCR')
      expect(productOverall).not.toBeNull()
      expect(productOverall!.status).toBe('NON_COMPLIANT')
      expect(productOverall!.requirementId).toBeNull()
      expect(productOverall!.sourceId).toBeNull()

      // Regulation-level aggregate for SRC-DDCR should also be NON_COMPLIANT
      const regAggregate = allRecords.find(
        r => r.requirementId === null && r.sourceId === 'SRC-DDCR'
      )
      expect(regAggregate).toBeDefined()
      expect(regAggregate!.status).toBe('NON_COMPLIANT')
    })

    it('produces COMPLIANT aggregates after a requirement is marked compliant', () => {
      // Replace the NON_COMPLIANT requirement-level record with a COMPLIANT one
      sqlite.exec(`UPDATE ddcr_reporting_records SET status = 'COMPLIANT' WHERE id = 'DDCR-REC-001'`)

      recomputeAggregates('PROD-DDCR')

      const productOverall = getProductOverallStatus('PROD-DDCR')
      expect(productOverall).not.toBeNull()
      expect(productOverall!.status).toBe('COMPLIANT')
    })
  })
})
