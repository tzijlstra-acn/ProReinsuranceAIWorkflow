import mammoth from 'mammoth'
import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx'
import * as fs from 'fs'
import * as path from 'path'

export async function extractDocxText(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath })
  return result.value
}

function buildDocxChildren(lines: string[], docType: 'guideline' | 'sdd' | 'om' | 'audit') {
  return lines.map(line => {
    if (!line.trim()) return new Paragraph({ children: [] })

    // Title lines
    if (line.match(/^(Backup & Restore Guideline|System Design Document|Operating Manual)/)) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: line, bold: true, size: 32 })],
      })
    }
    // Markdown H1
    if (line.startsWith('# ')) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun(line.slice(2))],
      })
    }
    // Markdown H2
    if (line.startsWith('## ')) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun(line.slice(3))],
      })
    }
    // Markdown bullet
    if (line.startsWith('- ')) {
      return new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun(line.slice(2))],
      })
    }
    // Numbered section headings like "3. Backup Requirements"
    if (line.match(/^\d+\.\s+[A-Z]/)) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: line, bold: true })],
      })
    }
    // Numbered sub-section headings like "3.1 Automated Backup Jobs"
    if (line.match(/^\d+\.\d+\s+/)) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: line, bold: true })],
      })
    }
    // Version/metadata line
    if (line.includes('Version') && line.includes('|')) {
      return new Paragraph({
        children: [new TextRun({ text: line, italics: true, size: 20 })],
      })
    }
    // Change summary highlight
    if (line.includes('CHANGE SUMMARY:')) {
      return new Paragraph({
        children: [new TextRun({ text: line, bold: true, color: '003781' })],
      })
    }
    return new Paragraph({ children: [new TextRun(line)] })
  })
}

export async function createGuidelineV2Docx(outputPath: string, templateText: string): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  const lines = templateText.split('\n')
  const children = buildDocxChildren(lines, 'guideline')
  const doc = new Document({ sections: [{ children }] })
  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(outputPath, buffer)
}

export async function createSddV2Docx(outputPath: string, content: string): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  const lines = content.split('\n')
  const children = buildDocxChildren(lines, 'sdd')
  const doc = new Document({ sections: [{ children }] })
  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(outputPath, buffer)
}

export async function createOmV2Docx(outputPath: string, content: string): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  const lines = content.split('\n')
  const children = buildDocxChildren(lines, 'om')
  const doc = new Document({ sections: [{ children }] })
  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(outputPath, buffer)
}

export async function createAuditResponseDocx(outputPath: string, content: string): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  const lines = content.split('\n')
  const children = buildDocxChildren(lines, 'audit')
  const doc = new Document({ sections: [{ children }] })
  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(outputPath, buffer)
}
