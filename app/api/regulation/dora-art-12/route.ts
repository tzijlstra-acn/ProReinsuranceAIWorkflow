import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { regulationSources, requirements } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const EURLEX_HTML_URL = 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32022R2554'
const EURLEX_ELI_URL = 'https://eur-lex.europa.eu/eli/reg/2022/2554/oj/eng'
const CELEX = '32022R2554'

function extractArticle12FromHtml(html: string): string {
  // Locate "Article 12" heading — tolerate minor whitespace differences
  const art12Match = html.search(/Article\s+12\b/)
  if (art12Match === -1) return ''

  // End at "Article 13" if present
  const art13Match = html.search(/Article\s+13\b/)
  const snippet =
    art13Match > art12Match
      ? html.slice(art12Match, art13Match)
      : html.slice(art12Match, art12Match + 6000)

  return snippet
    .replace(/<[^>]+>/g, ' ')      // strip tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 4000)
}

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
          const extracted = extractArticle12FromHtml(html)
          if (extracted.length > 50) {
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
