import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { regulationSources, requirements } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { extractDoraArticle12FromHtml } from '@/lib/html-service'

const EURLEX_HTML_URL = 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32022R2554'
const EURLEX_ELI_URL = 'https://eur-lex.europa.eu/eli/reg/2022/2554/oj/eng'
const CELEX = '32022R2554'

export async function GET() {
  try {
    const source = db
      .select()
      .from(regulationSources)
      .where(eq(regulationSources.id, 'DORA-ART-12'))
      .get()
    if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const reqs = db
      .select()
      .from(requirements)
      .where(eq(requirements.regulationSourceId, 'DORA-ART-12'))
      .all()

    const fixtureData = JSON.parse(source.fixture) as Record<string, unknown>
    const fetchEnabled = process.env.EURLEX_FETCH_ENABLED === 'true'

    let liveSource: 'live' | 'fixture' = 'fixture'
    let fetchedAt: string | null = null
    // Default article text from fixture requirements
    let article12Text: string =
      (fixtureData.requirements as string[] | undefined)?.join('\n\n') ?? source.title

    if (fetchEnabled) {
      try {
        const controller = new AbortController()
        const tid = setTimeout(() => controller.abort(), 10_000)
        const res = await fetch(EURLEX_HTML_URL, {
          signal: controller.signal,
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'AoC-Control-Line/1.0 (regulatory-demo)',
          },
        })
        clearTimeout(tid)

        if (res.ok) {
          const html = await res.text()
          const { text: extracted } = extractDoraArticle12FromHtml(html)
          if (extracted.length > 100) {
            article12Text = extracted
            liveSource = 'live'
            fetchedAt = new Date().toISOString()

            // Persist fetched text + timestamp into the DB row
            const updatedFixture = JSON.stringify({
              ...fixtureData,
              liveText: extracted,
              fetchedAt,
            })
            db.update(regulationSources)
              .set({ isLive: true, cachedAt: fetchedAt, fixture: updatedFixture })
              .where(eq(regulationSources.id, 'DORA-ART-12'))
              .run()
          }
        }
      } catch {
        // Network unavailable or timeout — fall through to fixture
      }
    } else if (source.isLive && typeof fixtureData.liveText === 'string') {
      // Previously cached live text — return it without re-fetching
      article12Text = fixtureData.liveText
      liveSource = 'live'
      fetchedAt = source.cachedAt ?? null
    }

    return NextResponse.json({
      source: liveSource,
      fetchedAt,
      article12Text,
      eurLexUrl: EURLEX_ELI_URL,
      celex: CELEX,
      fixture: fixtureData,
      requirements: reqs,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
