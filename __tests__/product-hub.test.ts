import { describe, it, expect, beforeEach } from 'vitest'
import { db, sqlite } from '@/lib/db/index'
import {
  products,
  productApplicability,
  productGaps,
  regulatoryRequirements,
  regulatorySources,
  requirementStatusHistory,
} from '@/lib/db/schema'
import {
  getProducts,
  getProduct,
  getProductComplianceSummary,
  getProductGaps,
  updateProductGapStatus,
} from '@/lib/domain/product-hub'
import { randomUUID } from 'crypto'

const NOW = new Date().toISOString()
// Use a timestamp slightly in the past so any later inserts are definitively newer
const PAST = new Date(Date.now() - 60_000).toISOString()

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

describe('Product Hub', () => {
  beforeEach(() => {
    sqlite.exec(CLEAR_SQL)

    db.insert(regulatorySources).values([
      {
        id: 'SRC-TEST1',
        shortCode: 'DORA',
        name: 'Digital Operational Resilience Act',
        jurisdiction: 'EU',
        status: 'active',
      },
      {
        id: 'SRC-TEST2',
        shortCode: 'NIS2',
        name: 'NIS2 Directive',
        jurisdiction: 'EU',
        status: 'active',
      },
    ]).run()

    db.insert(regulatoryRequirements).values([
      {
        id: 'REQ-TEST1',
        sourceId: 'SRC-TEST1',
        versionId: 'REGV-TEST1',
        articleRef: 'Art. 12(1)',
        title: 'Backup Requirement',
        description: 'Must maintain backups',
        obligationType: 'TECHNICAL_CONTROL',
        obligationLevel: 'MANDATORY',
        status: 'active',
      },
      {
        id: 'REQ-TEST2',
        sourceId: 'SRC-TEST2',
        versionId: 'REGV-TEST2',
        articleRef: 'Art. 5(1)',
        title: 'Security Requirement',
        description: 'Must implement security measures',
        obligationType: 'TECHNICAL_CONTROL',
        obligationLevel: 'MANDATORY',
        status: 'active',
      },
    ]).run()

    db.insert(products).values({
      id: 'PROD-TEST',
      name: 'Test Product',
      type: 'IT_APPLICATION',
      criticality: 'HIGH',
    }).run()

    db.insert(productApplicability).values([
      {
        id: randomUUID(),
        productId: 'PROD-TEST',
        requirementId: 'REQ-TEST1',
        sourceId: 'SRC-TEST1',
        applicable: true,
        assessedAt: PAST,
      },
      {
        id: randomUUID(),
        productId: 'PROD-TEST',
        requirementId: 'REQ-TEST2',
        sourceId: 'SRC-TEST2',
        applicable: false,
        assessedAt: PAST,
      },
    ]).run()

    db.insert(productGaps).values({
      id: 'PG-TEST',
      productId: 'PROD-TEST',
      requirementId: 'REQ-TEST1',
      title: 'Backup Configuration Gap',
      description: 'Backup is not configured',
      gapType: 'CONFIGURATION',
      severity: 'HIGH',
      status: 'OPEN',
      detectedAt: PAST,
    }).run()

    db.insert(requirementStatusHistory).values({
      id: randomUUID(),
      productId: 'PROD-TEST',
      requirementId: 'REQ-TEST1',
      sourceId: 'SRC-TEST1',
      status: 'NON_COMPLIANT',
      transitionedAt: PAST,
    }).run()
  })

  describe('getProducts', () => {
    it('returns all products', () => {
      const prods = getProducts()
      expect(prods).toHaveLength(1)
      expect(prods[0].id).toBe('PROD-TEST')
    })
  })

  describe('getProduct', () => {
    it('returns the product by id', () => {
      const prod = getProduct('PROD-TEST')
      expect(prod).not.toBeNull()
      expect(prod!.id).toBe('PROD-TEST')
      expect(prod!.type).toBe('IT_APPLICATION')
      expect(prod!.criticality).toBe('HIGH')
    })

    it('returns null for a missing id', () => {
      expect(getProduct('missing')).toBeNull()
    })
  })

  describe('getProductComplianceSummary', () => {
    it('returns one entry per applicability record (2 total)', () => {
      const summary = getProductComplianceSummary('PROD-TEST')
      expect(summary).toHaveLength(2)
    })

    it('the applicable=true entry has currentStatus NON_COMPLIANT', () => {
      const summary = getProductComplianceSummary('PROD-TEST')
      const applicableEntry = summary.find(s => s.applicable === true)
      expect(applicableEntry).toBeDefined()
      expect(applicableEntry!.currentStatus).toBe('NON_COMPLIANT')
    })

    it('the applicable=false entry has currentStatus NOT_ASSESSED', () => {
      const summary = getProductComplianceSummary('PROD-TEST')
      const notApplicableEntry = summary.find(s => s.applicable === false)
      expect(notApplicableEntry).toBeDefined()
      expect(notApplicableEntry!.currentStatus).toBe('NOT_ASSESSED')
    })

    it('returns an empty array for a product with no applicability records', () => {
      const summary = getProductComplianceSummary('NONEXISTENT')
      expect(summary).toHaveLength(0)
    })
  })

  describe('getProductGaps', () => {
    it('returns all gaps for a product', () => {
      const gaps = getProductGaps('PROD-TEST')
      expect(gaps).toHaveLength(1)
      expect(gaps[0].id).toBe('PG-TEST')
    })

    it('filters gaps by requirementId when one matches', () => {
      const gaps = getProductGaps('PROD-TEST', 'REQ-TEST1')
      expect(gaps).toHaveLength(1)
      expect(gaps[0].id).toBe('PG-TEST')
    })

    it('returns empty array when no gaps match the requirementId', () => {
      const gaps = getProductGaps('PROD-TEST', 'REQ-TEST2')
      expect(gaps).toHaveLength(0)
    })
  })

  describe('updateProductGapStatus', () => {
    it('updates the status of a product gap', () => {
      updateProductGapStatus('PG-TEST', 'RESOLVED')
      const gaps = getProductGaps('PROD-TEST')
      expect(gaps).toHaveLength(1)
      expect(gaps[0].status).toBe('RESOLVED')
    })
  })
})
