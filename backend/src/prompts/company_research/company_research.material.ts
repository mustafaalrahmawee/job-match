import { INVISIBLE_CHARS } from './company_research.config.js'
import type { CompanyResearchInput } from './company_research.schemas.js'

export function markedRequest({ company, question }: CompanyResearchInput, asOf: string, markId: string): string {
  const tag = `anfrage-${markId}`
  const field = (text: string) => text.replace(INVISIBLE_CHARS, '').replace(/\s+/gu, ' ').trim()
  return `<${tag} quelle="Formular im Coach-Fenster, von der Person ausgefüllt" stand="${asOf}">\nFirma: ${field(company)}\nFrage: ${field(question)}\n</${tag}>`
}
