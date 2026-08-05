import * as cheerio from 'cheerio'
import * as fs from 'fs'

/**
 * Extract DORA Article 12 text from a EUR-Lex HTML document.
 *
 * EUR-Lex has changed its HTML structure over the years. We try strategies
 * in order of reliability and stop at the first one that yields ≥100 chars.
 *
 * Strategy 1 — fixture format:  <article id="art_12">
 * Strategy 2 — EUR-Lex IDs:     any element whose id contains "art_12"
 * Strategy 3 — EUR-Lex anchors: <a name="art_12"> ancestor
 * Strategy 4 — heading scan:    find the <p>/<span> that says "Article 12",
 *                                collect siblings until the next article heading
 * Strategy 5 — text boundary:   plain-text slice between "Article 12" title
 *                                line and "Article 13" title line (≥300 chars apart)
 */
export function extractDoraArticle12(htmlPath: string): { text: string; paragraphs: string[] } {
  const html = fs.readFileSync(htmlPath, 'utf-8')
  return extractDoraArticle12FromHtml(html)
}

export function extractDoraArticle12FromHtml(html: string): { text: string; paragraphs: string[] } {
  const $ = cheerio.load(html)
  let articleText = ''

  // ── Strategy 1: <article id="art_12"> (fixture format) ──────────────────
  const art12El = $('article#art_12')
  if (art12El.length) {
    articleText = art12El.text().trim()
  }

  // ── Strategy 2: any element whose id contains "art_12" ──────────────────
  if (articleText.length < 100) {
    $('[id*="art_12"]').each((_, el) => {
      const t = $(el).text().trim()
      if (t.length > articleText.length) articleText = t
    })
  }

  // ── Strategy 3: <a name="art_12"> — take its parent container ───────────
  if (articleText.length < 100) {
    const anchor = $('a[name="art_12"]')
    if (anchor.length) {
      // Walk up to a substantial container (div/section/article)
      let el = anchor.parent()
      for (let i = 0; i < 5 && el.length; i++) {
        const tag = el.get(0)?.tagName ?? ''
        if (['div', 'section', 'article'].includes(tag) && el.text().trim().length > 200) {
          articleText = el.text().trim()
          break
        }
        el = el.parent()
      }
    }
  }

  // ── Strategy 4: heading scan ─────────────────────────────────────────────
  // Find the element whose text is (approximately) "Article 12 <title>",
  // then collect everything until the "Article 13" heading.
  if (articleText.length < 100) {
    const headingEl = $('h1,h2,h3,h4,p,span,div').filter((_, el) => {
      const t = $(el).text().trim()
      return /^Article\s+12\b/.test(t) && t.length < 200
    }).first()

    if (headingEl.length) {
      // Collect text from the heading's parent container
      const container = headingEl.parent()
      const collected: string[] = []
      let found = false

      container.children().each((_, child) => {
        const t = $(child).text().trim()
        if (!found && /^Article\s+12\b/.test(t)) found = true
        if (found) {
          if (/^Article\s+13\b/.test(t)) return false // stop
          collected.push(t)
        }
      })

      if (collected.length) articleText = collected.join('\n').trim()
    }
  }

  // ── Strategy 5: plain-text boundary extraction ───────────────────────────
  if (articleText.length < 100) {
    const bodyText = $('body').text()
    // Split into lines and look for the Article 12 title line — it should be
    // substantially longer than a ToC entry (ToC lines are typically < 80 chars).
    const lines = bodyText.split('\n').map(l => l.trim()).filter(Boolean)

    let start = -1
    let end = -1
    for (let i = 0; i < lines.length; i++) {
      if (/^Article\s+12\b/.test(lines[i]) && start === -1) {
        // Verify this is the real article: the next few lines should have
        // paragraph content (> 60 chars), not just a ToC entry.
        const peek = lines.slice(i + 1, i + 4).join(' ')
        if (peek.length > 60) start = i
      }
      if (/^Article\s+13\b/.test(lines[i]) && start !== -1 && end === -1) {
        end = i
      }
    }

    if (start !== -1) {
      const slice = end !== -1 ? lines.slice(start, end) : lines.slice(start, start + 40)
      articleText = slice.join('\n').trim()
    }
  }

  const paragraphs = articleText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 20)

  return { text: articleText, paragraphs }
}
