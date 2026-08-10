/**
 * Central terminology source for the Munich Re Automation of Compliance platform.
 * All visible labels must be sourced from here — never hard-coded in components.
 *
 * See docs/MUNICH_RE_TERMINOLOGY.md for the full glossary and approval status.
 * See docs/TERMINOLOGY_DECISIONS.md for open decisions and provisional assignments.
 */

export const TERM = {
  // ── Platform names ─────────────────────────────────────────────────────
  COMPLIANCE_HUB: 'Compliance Hub',
  PRODUCT_HUB: 'Product Hub',
  DDCR: 'DDCR',
  ESSENTIALS: 'Essentials',

  // ── AI assistants ──────────────────────────────────────────────────────
  // MITRA: Compliance Hub — regulatory analysis and policy/control gap analysis
  // MAYA:  Product Hub — work-product analysis, documentation updates, remediation
  // IMPORTANT: These names are provisionally assigned pending Munich Re confirmation.
  // Do not swap them. See docs/TERMINOLOGY_DECISIONS.md.
  MITRA: 'MITRA',
  MAYA: 'MAYA',

  // ── Work objects ────────────────────────────────────────────────────────
  WORK_PRODUCT: 'work product',
  WORK_PRODUCTS: 'work products',
  SDD: 'SDD',
  OPERATING_MANUAL: 'Operating Manual',
  FINDING: 'finding',
  ACTIONABLE_TASK: 'actionable task',
  MIGRATION_VIEW: 'migration view',
  CONTROL_ACTIVITY: 'Control Activity',

  // ── Status labels ────────────────────────────────────────────────────────
  NON_COMPLIANT: 'Non-compliant',
  COMPLIANT: 'Compliant',
  IN_REMEDIATION: 'In Remediation',
  NOT_APPLICABLE: 'Not Applicable',
  NOT_ASSESSED: 'Not Assessed',

  // ── Demo case reference ─────────────────────────────────────────────────
  // Used in the board demo to anchor the single illustrative case.
  DEMO_CASE_PRODUCT: 'IT App X',
  DEMO_CASE_REG: 'DORA',
  DEMO_CASE_ARTICLE: 'Art. 12(1)(c)',
  DEMO_CASE_REQUIREMENT: 'Backup geographic redundancy',
} as const

export type Term = typeof TERM
export type TermKey = keyof Term
