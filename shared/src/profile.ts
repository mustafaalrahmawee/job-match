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

export const CvFileNameSchema = z.string().trim().min(1).max(200);

export const CvSchema = z.object({
  id: z.uuid(),
  fileName: z.string().nullable(),
  role: RoleSchema.nullable(),
  active: z.boolean(),
  sizeBytes: z.number().int(),
  createdAt: z.iso.datetime(),
});

export const CvListSchema = z.array(CvSchema);

export const SetCvRoleSchema = z.object({ role: RoleSchema });

export const DeleteCvsSchema = z.object({ ids: z.array(z.uuid()).min(1).max(50) });

export type Cv = z.infer<typeof CvSchema>;
