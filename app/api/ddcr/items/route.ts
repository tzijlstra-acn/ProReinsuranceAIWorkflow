import { NextRequest, NextResponse } from 'next/server'
import { getDdcrItems } from '@/lib/domain/ddcr/items'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl

    const filter = {
      entityType: searchParams.get('entityType') ?? undefined,
      tower: searchParams.get('tower') ?? undefined,
      reportingStatus: searchParams.get('reportingStatus') ?? undefined,
      executionStatus: searchParams.get('executionStatus') ?? undefined,
      sourceSystem: searchParams.get('sourceSystem') ?? undefined,
      actionOwner: searchParams.get('actionOwner') ?? undefined,
      regulatoryFramework: searchParams.get('regulatoryFramework') ?? undefined,
    }

    // Strip undefined keys so filter is clean
    const activeFilter = Object.fromEntries(
      Object.entries(filter).filter(([, v]) => v !== undefined)
    )

    const items = getDdcrItems(Object.keys(activeFilter).length > 0 ? activeFilter : undefined)
    return NextResponse.json({ items })
  } catch (err) {
    console.error('[DDCR Items GET]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
