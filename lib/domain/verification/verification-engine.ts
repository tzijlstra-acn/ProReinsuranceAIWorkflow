import { db } from '@/lib/db/index'
import {
  verificationCriteria,
  verificationResults,
  policyEvaluations,
  products,
  productWorkProducts,
} from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface VerificationResult {
  criterionId: string
  productId: string
  requirementId: string
  status: 'PASSED' | 'FAILED' | 'INCONCLUSIVE'
  observedValue?: unknown
  evidenceReference?: string
  verifiedAt: string
  notes?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run all verification criteria for a product+requirement.
 * Persists each result to verification_results and returns the array.
 */
export function runVerification(productId: string, requirementId: string): VerificationResult[] {
  const criteria = db.select().from(verificationCriteria)
    .where(eq(verificationCriteria.requirementId, requirementId))
    .all()

  return criteria.map(c => runCriterion(c.id, productId, requirementId))
}

/**
 * Run a single verification criterion by ID.
 * Persists the result and returns it.
 */
export function runCriterion(
  criterionId: string,
  productId: string,
  requirementId: string
): VerificationResult {
  const now = new Date().toISOString()
  const criterion = db.select().from(verificationCriteria)
    .where(eq(verificationCriteria.id, criterionId))
    .all()[0]

  if (!criterion) {
    const result: VerificationResult = {
      criterionId,
      productId,
      requirementId,
      status: 'INCONCLUSIVE',
      verifiedAt: now,
      notes: 'Criterion not found in database.',
    }
    persistResult(result)
    return result
  }

  let result: VerificationResult

  switch (criterion.verifierType) {
    case 'TECHNICAL_POLICY':
      result = runTechnicalPolicyCheck(criterion, productId, requirementId, now)
      break
    case 'DOCUMENT_APPROVAL':
    case 'WORKFLOW_EVIDENCE':
      result = runWorkProductCheck(criterion, productId, requirementId, now)
      break
    default:
      result = {
        criterionId,
        productId,
        requirementId,
        status: 'INCONCLUSIVE',
        verifiedAt: now,
        notes: `Verifier type '${criterion.verifierType}' requires manual assessment.`,
      }
  }

  persistResult(result)
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal runners
// ─────────────────────────────────────────────────────────────────────────────

type CriterionRow = {
  id: string
  policyCode: string | null
  title: string
  verifierType: string
  expectedValue: string | null
}

function runTechnicalPolicyCheck(
  criterion: CriterionRow,
  productId: string,
  requirementId: string,
  now: string
): VerificationResult {
  if (!criterion.policyCode) {
    return {
      criterionId: criterion.id,
      productId,
      requirementId,
      status: 'INCONCLUSIVE',
      verifiedAt: now,
      notes: 'No policy code configured for this TECHNICAL_POLICY criterion.',
    }
  }

  const product = db.select().from(products)
    .where(eq(products.id, productId))
    .all()[0]

  if (!product?.applicationId) {
    return {
      criterionId: criterion.id,
      productId,
      requirementId,
      status: 'INCONCLUSIVE',
      verifiedAt: now,
      notes: 'Product has no linked applicationId — cannot look up policy evaluations.',
    }
  }

  const evals = db.select().from(policyEvaluations)
    .where(
      and(
        eq(policyEvaluations.policyCode, criterion.policyCode),
        eq(policyEvaluations.applicationId, product.applicationId)
      )
    )
    .all()

  if (evals.length === 0) {
    return {
      criterionId: criterion.id,
      productId,
      requirementId,
      status: 'INCONCLUSIVE',
      observedValue: { policyCode: criterion.policyCode, evaluationCount: 0 },
      verifiedAt: now,
      notes: `No policy evaluation found for ${criterion.policyCode} on application ${product.applicationId}.`,
    }
  }

  evals.sort((a, b) => (b.evaluatedAt ?? '').localeCompare(a.evaluatedAt ?? ''))
  const latest = evals[0]

  const statusMap: Record<string, 'PASSED' | 'FAILED' | 'INCONCLUSIVE'> = {
    Compliant: 'PASSED',
    NonCompliant: 'FAILED',
    NotEvaluated: 'INCONCLUSIVE',
  }

  return {
    criterionId: criterion.id,
    productId,
    requirementId,
    status: statusMap[latest.status] ?? 'INCONCLUSIVE',
    observedValue: {
      policyCode: criterion.policyCode,
      policyStatus: latest.status,
      applicationId: product.applicationId,
      evaluatedAt: latest.evaluatedAt,
    },
    evidenceReference: latest.id,
    verifiedAt: now,
    notes: `Policy evaluation ${criterion.policyCode}: ${latest.status}`,
  }
}

function runWorkProductCheck(
  criterion: CriterionRow,
  productId: string,
  requirementId: string,
  now: string
): VerificationResult {
  if (!criterion.expectedValue) {
    return {
      criterionId: criterion.id,
      productId,
      requirementId,
      status: 'INCONCLUSIVE',
      verifiedAt: now,
      notes: 'No expectedValue configured for this criterion.',
    }
  }

  let expected: { workProductId?: string } = {}
  try {
    expected = JSON.parse(criterion.expectedValue) as { workProductId?: string }
  } catch {
    return {
      criterionId: criterion.id,
      productId,
      requirementId,
      status: 'INCONCLUSIVE',
      verifiedAt: now,
      notes: 'Could not parse expectedValue as JSON.',
    }
  }

  const { workProductId } = expected
  if (!workProductId) {
    return {
      criterionId: criterion.id,
      productId,
      requirementId,
      status: 'INCONCLUSIVE',
      verifiedAt: now,
      notes: 'No workProductId specified in expectedValue.',
    }
  }

  const wp = db.select().from(productWorkProducts)
    .where(eq(productWorkProducts.id, workProductId))
    .all()[0]

  if (!wp) {
    return {
      criterionId: criterion.id,
      productId,
      requirementId,
      status: 'INCONCLUSIVE',
      observedValue: { workProductId, found: false },
      verifiedAt: now,
      notes: `Work product ${workProductId} not found in database.`,
    }
  }

  const status: 'PASSED' | 'FAILED' = wp.status === 'FULFILLED' ? 'PASSED' : 'FAILED'

  return {
    criterionId: criterion.id,
    productId,
    requirementId,
    status,
    observedValue: {
      workProductId,
      workProductTitle: wp.title,
      workProductStatus: wp.status,
    },
    evidenceReference: workProductId,
    verifiedAt: now,
    notes: status === 'PASSED'
      ? `Work product "${wp.title}" is FULFILLED.`
      : `Work product "${wp.title}" status is ${wp.status} — must be FULFILLED to pass.`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────────────────

function persistResult(result: VerificationResult): void {
  db.insert(verificationResults).values({
    id: randomUUID(),
    criterionId: result.criterionId,
    productId: result.productId,
    requirementId: result.requirementId,
    remediationCaseId: null,
    status: result.status,
    observedValue: result.observedValue !== undefined ? JSON.stringify(result.observedValue) : null,
    evidenceReference: result.evidenceReference ?? null,
    verifiedAt: result.verifiedAt,
    notes: result.notes ?? null,
  }).run()
}
