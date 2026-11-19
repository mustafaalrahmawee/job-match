import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import { PageSizes, PDFDocument, rgb, type Color, type PDFFont, type PDFPage } from 'pdf-lib'
import * as cvConfig from '../../../src/prompts/cv_analysis/cv_analysis.config.js'
import { CASES_DIR, caseIds, readCase, type CvCase } from './cv_analysis.cases.js'

const MARGIN = 50
const GUTTER = 12
const FONTS_DIR = join(import.meta.dirname, '../../fonts')

type Style = { font: PDFFont; size: number; leading: number; color: Color }

type Row = { text: string; style: Style }

export async function casePdf(evalCase: CvCase): Promise<Uint8Array> {
  const pages = evalCase.text.split('\f')
  if (pages.length > cvConfig.MAX_PAGES) throw new Error(`${pages.length} Seiten, erlaubt sind ${cvConfig.MAX_PAGES}`)
  const hidden = evalCase.hidden ?? []
  const outside = hidden.find((entry) => entry.page > pages.length)
  if (outside) throw new Error(`hidden auf Seite ${outside.page}, das PDF hat ${pages.length} Seiten`)
  const doc = await PDFDocument.create({ updateMetadata: false })
  doc.registerFontkit(fontkit)
  const regular = await doc.embedFont(readFileSync(join(FONTS_DIR, 'DejaVuSans.ttf')), { subset: true })
  const bold = await doc.embedFont(readFileSync(join(FONTS_DIR, 'DejaVuSans-Bold.ttf')), { subset: true })
  const body: Style = { font: regular, size: 9, leading: 12, color: rgb(0, 0, 0) }
  const heading: Style = { font: bold, size: 11, leading: 16, color: rgb(0, 0, 0) }
  const hiddenStyles: Record<'white' | 'tiny', Style> = {
    white: { ...body, color: rgb(1, 1, 1) },
    tiny: { font: regular, size: 1, leading: 1.2, color: rgb(0.85, 0.85, 0.85) },
  }
  const [width, height] = PageSizes.A4
  const full = width - 2 * MARGIN
  const third = full / 3
  for (const [index, text] of pages.entries()) {
    const page = doc.addPage(PageSizes.A4)
    const sidebar = index === 0 ? evalCase.sidebar : undefined
    const x = sidebar === undefined ? MARGIN : MARGIN + third
    const columnWidth = sidebar === undefined ? full : full - third
    if (sidebar !== undefined && draw(page, rows(sidebar, body, null, third - GUTTER), MARGIN, height - MARGIN) < MARGIN) {
      throw new Error('Seitenleiste passt nicht auf Seite 1')
    }
    let y = draw(page, rows(text, body, heading, columnWidth), x, height - MARGIN)
    for (const entry of hidden.filter((item) => item.page === index + 1)) {
      y = draw(page, rows(entry.text, hiddenStyles[entry.style], null, columnWidth), x, y)
    }
    if (y < MARGIN) throw new Error(`Seite ${index + 1} passt nicht auf eine Seite des PDF`)
    if (evalCase.header) draw(page, [{ text: evalCase.header, style: body }], MARGIN, height - MARGIN + 32)
    if (evalCase.footer) draw(page, [{ text: evalCase.footer, style: body }], MARGIN, MARGIN - 18)
  }
  const { title, author, subject, keywords } = evalCase.metadata ?? {}
  if (title !== undefined) doc.setTitle(title)
  if (author !== undefined) doc.setAuthor(author)
  if (subject !== undefined) doc.setSubject(subject)
  if (keywords !== undefined) doc.setKeywords([keywords])
  const date = new Date(evalCase.analyzedAt)
  doc.setCreationDate(date)
  doc.setModificationDate(date)
  return doc.save()
}

export async function writePdfs(): Promise<void> {
  const dir = join(CASES_DIR, 'pdf')
  mkdirSync(dir, { recursive: true })
  for (const id of caseIds()) {
    const file = join(dir, `${id}.pdf`)
    try {
      rmSync(file, { force: true })
      writeFileSync(file, await casePdf(readCase(id)))
      console.log(`${id}: pdf/${id}.pdf`)
    } catch (error) {
      console.error(`${id}: ${error instanceof Error ? error.message : String(error)}`)
      process.exitCode = 1
    }
  }
}

function rows(text: string, body: Style, heading: Style | null, width: number): Row[] {
  return text.split('\n').flatMap((line) => {
    const style = heading !== null && line.startsWith('# ') ? heading : body
    const shown = style === body ? line : line.slice(2)
    return wrap(shown, style, width).map((row) => ({ text: row, style }))
  })
}

function wrap(line: string, style: Style, width: number): string[] {
  const fits = (text: string) =>
    [...text].reduce((sum, char) => sum + style.font.widthOfTextAtSize(char, style.size), 0) <= width
  const result: string[] = []
  let row: string | undefined
  for (const word of line.split(' ').flatMap((word) => pieces(word, fits))) {
    const next = row === undefined ? word : `${row} ${word}`
    if (row === undefined || fits(next)) {
      row = next
    } else {
      result.push(row)
      row = word
    }
  }
  result.push(row ?? '')
  return result
}

function pieces(word: string, fits: (text: string) => boolean): string[] {
  const result: string[] = []
  let piece = ''
  for (const char of word) {
    if (piece !== '' && !fits(piece + char)) {
      result.push(piece)
      piece = ''
    }
    piece += char
  }
  return [...result, piece]
}

function draw(page: PDFPage, items: Row[], x: number, top: number): number {
  let y = top
  for (const { text, style } of items) {
    y -= style.leading
    if (text) page.drawText(text, { x, y, font: style.font, size: style.size, color: style.color })
  }
  return y
}
