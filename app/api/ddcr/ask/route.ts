import { NextRequest, NextResponse } from 'next/server'
import { getDdcrItems } from '@/lib/domain/ddcr/items'
import { getAiProvider } from '@/lib/ai/provider'

interface AskBody {
  question: string
  context?: {
    entityId?: string
    tower?: string
    framework?: string
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as AskBody
    const { question, context } = body

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'question is required' }, { status: 400 })
    }

    // Fetch relevant items based on context filters
    const filter: Record<string, string> = {}
    if (context?.tower) filter.tower = context.tower
    if (context?.framework) filter.regulatoryFramework = context.framework

    let items = getDdcrItems(Object.keys(filter).length > 0 ? filter : undefined)

    // If entityId provided, narrow further
    if (context?.entityId) {
      items = items.filter(i => i.entityId === context.entityId)
    }

    // Limit to 20 most actionable items (non-compliant/overdue first)
    const priorityOrder: Record<string, number> = {
      OVERDUE: 0,
      ACTION_REQUIRED: 1,
      IN_PROGRESS: 2,
      COMPLETED: 3,
    }
    items = [...items]
      .sort((a, b) => (priorityOrder[a.executionStatus] ?? 9) - (priorityOrder[b.executionStatus] ?? 9))
      .slice(0, 20)

    const itemIds = items.map(i => i.id)

    // Build a plain-text summary of the items for the AI context
    const statusCounts = {
      compliant: items.filter(i => i.reportingStatus === 'COMPLIANT').length,
      nonCompliant: items.filter(i => i.reportingStatus === 'NON_COMPLIANT').length,
      partial: items.filter(i => i.reportingStatus === 'PARTIALLY_COMPLIANT').length,
      overdue: items.filter(i => i.executionStatus === 'OVERDUE').length,
    }

    const itemSummaryLines = items.map(item =>
      `[${item.id}] ${item.entityName} | ${item.regulatoryFramework} ${item.requirementRef} | ` +
      `Tower: ${item.tower} | Owner: ${item.actionOwner ?? 'unassigned'} | ` +
      `Reporting: ${item.reportingStatus} | Execution: ${item.executionStatus} | ` +
      (item.nextAction ? `Next action: ${item.nextAction}` : 'No action pending') +
      (item.dueDate ? ` | Due: ${item.dueDate}` : '') +
      (item.sourceSystem ? ` | Source: ${item.sourceSystem}` : '')
    ).join('\n')

    const additionalContext =
      `\n\nDDCR Cockpit — Federated Compliance Status\n` +
      `Items in scope: ${items.length} (of up to 20 most actionable)\n` +
      `Compliant: ${statusCounts.compliant} | Non-compliant: ${statusCounts.nonCompliant} | ` +
      `Partially compliant: ${statusCounts.partial} | Overdue: ${statusCounts.overdue}\n\n` +
      `Item details:\n${itemSummaryLines}\n\n` +
      `Source systems represented: ${[...new Set(items.map(i => i.sourceSystem))].join(', ')}\n` +
      `Regulatory frameworks: ${[...new Set(items.map(i => i.regulatoryFramework))].join(', ')}`

    const ai = getAiProvider()

    // Use answerAuditQuestion with DDCR context
    const result = await ai.answerAuditQuestion(question, {
      regulation: {
        id: 'DDCR',
        articleId: 'ALL',
        title: 'DDCR Federated Compliance Cockpit',
        requirements: [],
      },
      portfolioCompliantCount: statusCounts.compliant,
      portfolioTotalCount: items.length,
      exceptions: items
        .filter(i => i.reportingStatus === 'NON_COMPLIANT' || i.executionStatus === 'OVERDUE')
        .map(i => `${i.entityName} — ${i.regulatoryFramework} ${i.requirementRef}`),
      deploymentSha: 'N/A',
      deploymentDate: new Date().toISOString(),
      sddVersion: 'N/A',
      omVersion: 'N/A',
      additionalContext,
    })

    return NextResponse.json({
      answer: result.directResponse,
      sections: result.sections,
      sources: itemIds,
    })
  } catch (err) {
    console.error('[DDCR Ask POST]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
