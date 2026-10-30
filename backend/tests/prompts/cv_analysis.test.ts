import { expect, test } from 'vitest'
import {
  CV_ANALYSIS_EFFORT,
  CV_ANALYSIS_JSON_SCHEMA,
  CV_ANALYSIS_MODEL,
  CV_ROLES,
  cvAnalysisRequest,
} from '../../src/prompts/cv_analysis.js'

const PDF_BASE64 = Buffer.from('%PDF-1.7\nLebenslauf\n%%EOF').toString('base64')

test('the request sends the PDF with model, effort and the schema', () => {
  const params = cvAnalysisRequest(PDF_BASE64)

  expect(params.model).toBe(CV_ANALYSIS_MODEL)
  expect(params.thinking).toEqual({ type: 'adaptive' })
  expect(params.output_config).toEqual({
    effort: CV_ANALYSIS_EFFORT,
    format: { type: 'json_schema', schema: CV_ANALYSIS_JSON_SCHEMA },
  })
  expect(params.messages).toEqual([
    {
      role: 'user',
      content: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: PDF_BASE64 } }],
    },
  ])
})

test('a variant changes only model and effort', () => {
  const params = cvAnalysisRequest(PDF_BASE64, { model: 'claude-sonnet-5-5', effort: 'high' })

  expect(params.model).toBe('claude-sonnet-5-5')
  expect(params.output_config?.effort).toBe('high')
  expect(params.messages).toEqual(cvAnalysisRequest(PDF_BASE64).messages)
})

test('the schema allows only a role from the fixed list', () => {
  const properties = (CV_ANALYSIS_JSON_SCHEMA as { properties: Record<string, { enum?: string[] }> }).properties
  expect(properties.suggested_role.enum).toEqual([...CV_ROLES])
})
