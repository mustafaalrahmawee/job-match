import { z } from 'zod';

export const MAX_CV_BYTES = 5 * 1024 * 1024;

export const RoleSchema = z.enum([
  'frontend',
  'backend',
  'fullstack',
  'mobile',
  'devops',
  'data_ai',
  'qa',
  'ux_ui',
  'it_support',
  'it_project',
  'embedded',
  'it_security',
]);

export type Role = z.infer<typeof RoleSchema>;

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  frontend: 'Frontend-Entwicklung',
  backend: 'Backend-Entwicklung',
  fullstack: 'Fullstack-Entwicklung',
  mobile: 'Mobile-Entwicklung',
  devops: 'DevOps und Cloud',
  data_ai: 'Data und KI',
  qa: 'Qualitätssicherung und Test',
  ux_ui: 'UX/UI-Design',
  it_support: 'IT-Support und Administration',
  it_project: 'IT-Projektmanagement',
  embedded: 'Embedded-Entwicklung',
  it_security: 'IT-Sicherheit',
};

export const CvAnalysisSchema = z.object({
  isCv: z.boolean().describe('true, wenn das Dokument ein Lebenslauf ist, sonst false'),
  language: z.enum(['de', 'en', 'other']).describe('Sprache des Lebenslaufs'),
  headline: z.string().describe('Kurzprofil der Person in einem Satz, auf Deutsch'),
  skills: z
    .array(z.string())
    .describe('Fachliche Fähigkeiten und Werkzeuge, höchstens 30; ohne Abschlüsse und Sprachen'),
  degrees: z
    .array(z.object({ title: z.string(), institution: z.string(), year: z.string() }))
    .describe('Abschlüsse und Ausbildungen; unbekannte Angaben als leerer String'),
  languages: z
    .array(z.object({ language: z.string(), level: z.string() }))
    .describe('Sprachen mit Niveau, z. B. C1 oder Muttersprache'),
  stations: z
    .array(z.object({ title: z.string(), company: z.string(), from: z.string(), to: z.string() }))
    .describe('Berufliche Stationen, neueste zuerst, höchstens 15'),
  strengths: z.array(z.string()).describe('Stärken des Lebenslaufs, höchstens 5'),
  improvements: z.array(z.string()).describe('Konkrete Verbesserungstipps, höchstens 5'),
  suggestedRole: RoleSchema.describe('Passendste Rolle aus der festen Liste'),
  roleExplanation: z
    .string()
    .describe('Kurze Erklärung der Rolle mit Belegen aus dem Lebenslauf, ein bis zwei Sätze'),
});

export type CvAnalysis = z.infer<typeof CvAnalysisSchema>;

export const AnalysisStatusSchema = z.enum(['none', 'running', 'done', 'failed']);

export const AnalysisErrorSchema = z.enum([
  'analysis_truncated',
  'refused',
  'pdf_too_long',
  'invalid_analysis',
  'not_a_cv',
  'batch_failed',
  'batch_expired',
]);

export type AnalysisStatus = z.infer<typeof AnalysisStatusSchema>;
export type AnalysisError = z.infer<typeof AnalysisErrorSchema>;

export const CvFileNameSchema = z.string().trim().min(1).max(200);

export const CvSchema = z.object({
  id: z.uuid(),
  fileName: z.string().nullable(),
  role: RoleSchema.nullable(),
  active: z.boolean(),
  sizeBytes: z.number().int(),
  createdAt: z.iso.datetime(),
  analysis: CvAnalysisSchema.nullable(),
  analysisStatus: AnalysisStatusSchema,
  analysisError: AnalysisErrorSchema.nullable(),
});

export const CvListSchema = z.array(CvSchema);

export const SetCvRoleSchema = z.object({ role: RoleSchema });

export const DeleteCvsSchema = z.object({ ids: z.array(z.uuid()).min(1).max(50) });

export type Cv = z.infer<typeof CvSchema>;
