/**
 * Client asset manifest for the board demo.
 *
 * Each entry represents a recording slot that Munich Re can later fill with a
 * real screen recording. Until the asset is supplied, the placeholder renders a
 * "Munich Re recording required" card.
 *
 * To add a real asset: set videoUrl to the path of a web-accessible video file.
 *
 * See docs/MUNICH_RE_ASSET_REQUESTS.md for the full request list with expected
 * content descriptions and recommended durations.
 */

export interface ClientAsset {
  id: string
  label: string
  description: string
  recommendedDuration: string
  placeholderText: string
  videoUrl?: string
}

export const CLIENT_ASSETS: ClientAsset[] = [
  {
    id: 'ASSET_REGULATORY_REVIEW',
    label: 'Regulatory or policy review',
    description:
      'Recording showing how Munich Re teams currently receive and review incoming ' +
      'regulatory or policy changes — the intake process before any system action.',
    recommendedDuration: '60–90 seconds',
    placeholderText: 'Munich Re recording required',
  },
  {
    id: 'ASSET_PRODUCT_HUB_COCKPIT',
    label: 'Product Hub product cockpit',
    description:
      'Recording of the current Product Hub or equivalent tool showing a product or ' +
      'application in context — the overview screen a Product Owner would open.',
    recommendedDuration: '30–60 seconds',
    placeholderText: 'Munich Re recording required',
  },
  {
    id: 'ASSET_ESSENTIALS_APPLICABILITY',
    label: 'Essentials / applicability criteria',
    description:
      'Recording showing how Essentials (or the current equivalent compliance framework) ' +
      'is used to determine which regulatory requirements apply to a product.',
    recommendedDuration: '45–75 seconds',
    placeholderText: 'Munich Re recording required',
  },
  {
    id: 'ASSET_WORK_PRODUCTS',
    label: 'Required work products',
    description:
      'Recording showing the list of required work products (SDDs, Operating Manuals, ' +
      'etc.) for a given product under the current compliance framework.',
    recommendedDuration: '30–45 seconds',
    placeholderText: 'Munich Re recording required',
  },
  {
    id: 'ASSET_SDD_OR_OM',
    label: 'SDD or Operating Manual',
    description:
      'Recording of an SDD or Operating Manual being opened and navigated — the document ' +
      'object the Product Team is responsible for maintaining.',
    recommendedDuration: '45–60 seconds',
    placeholderText: 'Munich Re recording required',
  },
  {
    id: 'ASSET_TASK_COMMENT',
    label: 'Existing task / comment mechanism',
    description:
      'Recording of the current task or comment system used by Product Teams to track ' +
      'compliance actions — e.g. Jira, ServiceNow, or an internal tool.',
    recommendedDuration: '30–45 seconds',
    placeholderText: 'Munich Re recording required',
  },
  {
    id: 'ASSET_DOC_UPDATE_MIGRATION',
    label: 'Document update or migration capability',
    description:
      'Recording of the current process for updating a document or migrating content ' +
      'during a compliance change — shows the before/after edit flow.',
    recommendedDuration: '60–90 seconds',
    placeholderText: 'Munich Re recording required',
  },
  {
    id: 'ASSET_VERIFICATION_RESULT',
    label: 'Technical verification result',
    description:
      'Recording of a current technical verification or policy-check result — e.g. an ' +
      'Azure Policy evaluation, a test result, or a manual check outcome.',
    recommendedDuration: '30–45 seconds',
    placeholderText: 'Munich Re recording required',
  },
  {
    id: 'ASSET_DDCR_REPORTING',
    label: 'Current DDCR reporting view',
    description:
      'Recording of the current DDCR or equivalent compliance-reporting view — showing ' +
      'a product or requirement\'s fulfilment status as it appears today.',
    recommendedDuration: '45–60 seconds',
    placeholderText: 'Munich Re recording required',
  },
]
