import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages'
import { JOB_TEXT_MAX_CHARS } from '../../modules/jobs/jobs.schemas.js'
import { cvAside } from '../cv_analysis/cv_analysis.material.js'
import type { CoachCv } from '../cv_analysis/cv_analysis.schemas.js'
import { INVISIBLE_CHARS, MATCH_CV_SECTIONS } from './match_analysis.config.js'
import type { CoachMatch, MatchJob } from './match_analysis.schemas.js'
import { AD_TITLES } from './match_analysis.texts.js'

export function adText(job: MatchJob): string {
  const head = [`Titel: ${job.title}`, ...(job.company ? [`Firma: ${job.company}`] : []), `Ort: ${job.city}`]
  const cut = job.description.length > JOB_TEXT_MAX_CHARS ? ' …' : ''
  const text = `${head.join('\n')}\n\n${job.description.slice(0, JOB_TEXT_MAX_CHARS)}${cut}`
  return text.replace(INVISIBLE_CHARS, '')
}

export function adDocument(job: MatchJob, text = adText(job), title = AD_TITLES[job.source]): ContentBlockParam {
  return {
    type: 'document',
    source: { type: 'text', media_type: 'text/plain', data: text },
    title,
  }
}

export function markedCv(cv: CoachCv, id: string): string {
  return cvAside(cv, MATCH_CV_SECTIONS)
    .replace(INVISIBLE_CHARS, '')
    .replace(/^<lebenslauf /u, `<lebenslauf-${id} `)
    .replace(/<\/lebenslauf>$/u, `</lebenslauf-${id}>`)
}

export function markedAd(job: MatchJob, id: string): string {
  return `<stellenanzeige-${id}>\n${adText(job)}\n</stellenanzeige-${id}>`
}

export function matchAside({ score, gaps, strengths, createdAt }: CoachMatch): string {
  const list = (items: { text: string }[]) => items.map((item) => `- ${item.text}`).join('\n') || '- keine'
  return `<match quelle="Match-Analyse in job-match zur aktiven Lebenslauf-Version" stand="${createdAt.toISOString().slice(0, 10)}">\nScore: ${score} von 100\n\nLücken:\n${list(gaps)}\n\nStärken:\n${list(strengths)}\n</match>`
}
