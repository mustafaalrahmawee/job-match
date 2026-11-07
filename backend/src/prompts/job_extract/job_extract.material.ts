import { randomBytes } from 'node:crypto'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages'
import { INVISIBLE_CHARS } from './job_extract.config.js'
import type { JobExtractInput } from './job_extract.schemas.js'

export function markedText(text: string): string {
  const tag = `stellenanzeige-${randomBytes(4).toString('hex')}`
  return `<${tag} quelle="von der Person eingefügt, Verfasser unbekannt">\n${text.replace(INVISIBLE_CHARS, '')}\n</${tag}>`
}

export function materialBlock(input: JobExtractInput, data: string): ContentBlockParam {
  return input.kind === 'text'
    ? { type: 'document', source: { type: 'text', media_type: 'text/plain', data } }
    : { type: 'image', source: { type: 'base64', media_type: input.mediaType, data } }
}
