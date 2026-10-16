import type { RequestHandler } from 'express'
import type { CvAnalysis, CvRole } from '../../prompts/cv_analysis.js'
import { authOf } from '../../shared/auth.middleware.js'
import { confirmRoleSchema, cvIdSchema, pdfSchema, type AnalysisError, type CvVersionOutput } from './cvs.schemas.js'
import type { CvsService, CvVersionInfo } from './cvs.service.js'

export class CvsController {
  constructor(private readonly cvs: CvsService) { }

  upload: RequestHandler = async (req, res) => {
    const pdf = pdfSchema.parse(req.body)
    const version = await this.cvs.upload(authOf(req).user.id, pdf)
    res.status(201).json(output(version))
  }

  active: RequestHandler = async (req, res) => {
    const version = await this.cvs.active(authOf(req).user.id)
    res.json(output(version))
  }

  retry: RequestHandler = async (req, res) => {
    const id = cvIdSchema.parse(req.params.id)
    const version = await this.cvs.retry(authOf(req).user.id, id)
    res.json(output(version))
  }

  confirmRole: RequestHandler = async (req, res) => {
    const id = cvIdSchema.parse(req.params.id)
    const { role } = confirmRoleSchema.parse(req.body)
    const version = await this.cvs.confirmRole(authOf(req).user.id, id, role)
    res.json(output(version))
  }
}

function output(version: CvVersionInfo): CvVersionOutput {
  return {
    id: version.id,
    status: version.analysisStatus,
    error: version.analysisError as AnalysisError | null,
    role: version.role as CvRole | null,
    analysis: version.analysis as CvAnalysis | null,
    created_at: version.createdAt,
  }
}
