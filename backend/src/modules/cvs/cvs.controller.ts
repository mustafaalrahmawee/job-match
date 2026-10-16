import type { RequestHandler } from 'express'
import type { CvAnalysis, CvRole } from '../../prompts/cv_analysis.js'
import { authOf } from '../../shared/auth.middleware.js'
import {
  confirmRoleSchema,
  cvIdSchema,
  pdfSchema,
  type AnalysisError,
  type CvVersionOutput,
  type CvVersionSummary,
} from './cvs.schemas.js'
import type { CvsService, CvVersionInfo, CvVersionSummaryInfo } from './cvs.service.js'

export class CvsController {
  constructor(private readonly cvs: CvsService) { }

  list: RequestHandler = async (req, res) => {
    const versions = await this.cvs.list(authOf(req).user.id)
    res.json(versions.map(summary))
  }

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

  activate: RequestHandler = async (req, res) => {
    const id = cvIdSchema.parse(req.params.id)
    const version = await this.cvs.activate(authOf(req).user.id, id)
    res.json(output(version))
  }

  remove: RequestHandler = async (req, res) => {
    const id = cvIdSchema.parse(req.params.id)
    await this.cvs.remove(authOf(req).user.id, id)
    res.status(204).end()
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

function summary(version: CvVersionSummaryInfo): CvVersionSummary {
  return {
    id: version.id,
    status: version.analysisStatus,
    error: version.analysisError as AnalysisError | null,
    role: version.role as CvRole | null,
    active: version.isActive,
    created_at: version.createdAt,
  }
}
