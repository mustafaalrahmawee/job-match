import { marked, oneLine } from '../../llm/untrusted.js'
import type { CompanyResearchInput } from './company_research.schemas.js'

export function markedRequest({ company, question }: CompanyResearchInput, asOf: string, markId: string): string {
  const block = `<anfrage quelle="Formular im Coach-Fenster, von der Person ausgefüllt" stand="${asOf}">\nFirma: ${oneLine(company)}\nFrage: ${oneLine(question)}\n</anfrage>`
  return marked(block, 'anfrage', markId)
}
