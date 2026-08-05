import * as cheerio from 'cheerio'
import * as fs from 'fs'

export function extractDoraArticle12(htmlPath: string): { text: string; paragraphs: string[] } {
  const html = fs.readFileSync(htmlPath, 'utf-8')
  const $ = cheerio.load(html)

  let article12Text = ''

  // Find article 12 by ID
  const art12 = $('article#art_12')
  if (art12.length > 0) {
    article12Text = art12.text().trim()
  }

  // Fallback: find by text boundary in full body text
  if (!article12Text) {
    const fullText = $('body').text()
    const start = fullText.indexOf('Article 12')
    const end = fullText.indexOf('Article 13')
    if (start !== -1 && end !== -1) {
      article12Text = fullText.slice(start, end).trim()
    }
  }

  const paragraphs = article12Text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 20)

  return { text: article12Text, paragraphs }
}
