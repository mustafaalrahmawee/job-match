import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

export const CASES_DIR = join(import.meta.dirname, '../../cases/cv_analysis')
const SHEET = join(import.meta.dirname, '../../../../docs/evals/cv_analysis.md')

const caseSchema = z.strictObject({
  id: z.string().regex(/^F\d{2}$/),
  tuple: z.string().regex(/^T\d{2}$/),
  analyzedAt: z.iso.datetime({ offset: true }),
  text: z.string(),
  sidebar: z.string().optional(),
  header: z.string().optional(),
  footer: z.string().optional(),
  hidden: z
    .array(z.strictObject({ text: z.string(), style: z.enum(['white', 'tiny']), page: z.number().int().positive() }))
    .optional(),
  metadata: z
    .strictObject({
      title: z.string().optional(),
      author: z.string().optional(),
      subject: z.string().optional(),
      keywords: z.string().optional(),
    })
    .optional(),
})

export type CvCase = z.infer<typeof caseSchema>

export function caseIds(): string[] {
  return readdirSync(CASES_DIR)
    .filter((file) => /^F\d{2}\.json$/.test(file))
    .map((file) => file.slice(0, -'.json'.length))
    .sort()
}

export function releasedIds(): string[] {
  const sheet = readFileSync(SHEET, 'utf8')
  const start = sheet.indexOf('\n### Fälle\n')
  if (start < 0) throw new Error('Tabelle „Fälle“ fehlt im Eval-Blatt')
  const rows = sheet
    .slice(start, sheet.indexOf('\n## ', start))
    .split('\n')
    .filter((line) => /^\| F\d{2} \|/.test(line))
    .map((line) => line.split(/(?<!\\)\|/).slice(1, -1).map((cell) => cell.trim()))
  const held = rows.filter(([id, , , file]) => file !== `\`${id}.json\`` && !file.includes('verworfen'))
  if (held.length > 0) throw new Error(`Zurückgehalten: ${held.map(([id]) => id).join(', ')}`)
  const released = rows.filter(([id, , , file]) => file === `\`${id}.json\``)
  const open = released.filter((row) => !row[5]).map(([id]) => id)
  if (open.length > 0) throw new Error(`Ohne Vorhersage (Person): ${open.join(', ')}`)
  if (released.length === 0) throw new Error('Kein freigegebener Fall in der Tabelle „Fälle“')
  return released.map(([id]) => id)
}

export function readCase(id: string): CvCase {
  const evalCase = caseSchema.parse(JSON.parse(readFileSync(join(CASES_DIR, `${id}.json`), 'utf8')))
  if (evalCase.id !== id) throw new Error(`id ${evalCase.id} in ${id}.json`)
  return evalCase
}
