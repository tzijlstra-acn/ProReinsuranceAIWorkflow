import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import * as fs from 'fs'
import * as path from 'path'

export function parseCsv<T extends Record<string, string>>(filePath: string): T[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  return parse(content, { columns: true, skip_empty_lines: true }) as T[]
}

export function writeCsv(filePath: string, records: Record<string, string>[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const content = stringify(records, { header: true })
  fs.writeFileSync(filePath, content, 'utf-8')
}
