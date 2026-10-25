export type User = { id: number; email: string }

export type HealthStatus = 'unknown' | 'ok' | 'error'

export type ApiOptions = { method?: string; body?: unknown; signal?: AbortSignal }

export type SseHandler = (event: string, data: unknown) => void

export type Role = 'user' | 'assistant'

export type CoachStep =
  | { kind: 'application'; application_id: number; title: string; company: string | null }
  | { kind: 'application_failed' }
  | { kind: 'web_search'; query: string; sources: number | null }

export type Source = { url: string; title: string | null }

export type ApiMessage = {
  id: number
  role: Role
  text: string
  steps: CoachStep[]
  sources: Source[]
  stop_reason: string | null
}

export type Conversation = { id: number; title: string; messages: ApiMessage[] }

export type ConversationSummary = { id: number; title: string }

export type Quality = 'normal' | 'extended'

export type Effort = 'medium' | 'high'

export type Delta = { text: string }

export type Done = { message: ApiMessage | null; stop_reason: string }

export type ChatMessage = {
  key: string
  role: Role
  text: string
  steps: CoachStep[]
  sources: Source[]
  stopReason: string | null
}

export const CV_ROLES = [
  'Frontend',
  'Backend',
  'Fullstack',
  'Mobile',
  'Data',
  'DevOps',
  'QA',
  'UX/UI',
  'IT-Support',
  'IT-Projektmanagement',
  'Andere',
] as const

export type CvRole = (typeof CV_ROLES)[number]

export type AnalysisStatus = 'none' | 'running' | 'ready' | 'failed'

export type CvAnalysis = {
  language: string
  suggested_role: CvRole
  positions: { employer: string; title: string; start: string | null; end: string | null }[]
  skills: string[]
  education: { degree: string; institution: string; year: string | null }[]
  highest_degree: string | null
  languages: { name: string; level: string | null }[]
  strengths: string[]
  weaknesses: string[]
  tips: string[]
}

export type CvVersion = {
  id: number
  status: AnalysisStatus
  error: string | null
  role: CvRole | null
  analysis: CvAnalysis | null
  created_at: string
}

export type CvVersionSummary = {
  id: number
  status: AnalysisStatus
  error: string | null
  role: CvRole | null
  active: boolean
  created_at: string
}

export type OfferType = 'work' | 'self_employment' | 'apprenticeship' | 'internship'

export const OFFER_LABELS: Record<OfferType, string | null> = {
  work: null,
  self_employment: 'Selbstständigkeit',
  apprenticeship: 'Ausbildung',
  internship: 'Praktikum',
}

export const REGION_LABELS = {
  BADEN_WUERTTEMBERG: 'Baden-Württemberg',
  BAYERN: 'Bayern',
  BERLIN: 'Berlin',
  BRANDENBURG: 'Brandenburg',
  BREMEN: 'Bremen',
  HAMBURG: 'Hamburg',
  HESSEN: 'Hessen',
  MECKLENBURG_VORPOMMERN: 'Mecklenburg-Vorpommern',
  NIEDERSACHSEN: 'Niedersachsen',
  NORDRHEIN_WESTFALEN: 'Nordrhein-Westfalen',
  RHEINLAND_PFALZ: 'Rheinland-Pfalz',
  SAARLAND: 'Saarland',
  SACHSEN: 'Sachsen',
  SACHSEN_ANHALT: 'Sachsen-Anhalt',
  SCHLESWIG_HOLSTEIN: 'Schleswig-Holstein',
  THUERINGEN: 'Thüringen',
} as const

export type Region = keyof typeof REGION_LABELS

export type WorkTime = 'full' | 'part'

export type JobSource = 'ba' | 'own'

export type Job = {
  id: number
  source: JobSource
  title: string
  company: string | null
  city: string
  region: Region | null
  offer_type: OfferType
  role: CvRole | null
  full_time: boolean
  part_time: boolean
  published_at: string
}

export type JobList = { total: number; pool_updated_at: string | null; jobs: Job[] }

export type JobFilter = {
  q: string
  role: CvRole | null
  region: Region | null
  workTime: WorkTime | null
  offerType: OfferType | null
}

export type JobDetail = Job & { description: string; salary: string | null; url: string | null }

export type JobDraft = {
  title: string | null
  company: string | null
  city: string | null
  offer_type: OfferType
  full_time: boolean
  part_time: boolean
  salary: string | null
  description: string
}

export type OwnJobInput = {
  title: string
  company: string
  city: string
  offer_type: OfferType
  full_time: boolean
  part_time: boolean
  salary: string
  description: string
}

export type MatchEntry = { ad_quote: string | null; cv_quote: string | null; text: string }

export type MatchResult = {
  id: number
  job_id: number
  score: number
  fit: string
  strengths: MatchEntry[]
  gaps: MatchEntry[]
  tips: MatchEntry[]
  archived: boolean
  created_at: string
  cv_version: { id: number; role: CvRole | null; created_at: string }
}

export type MatchOverview = { current: MatchResult | null; archived: MatchResult[] }

export type MatchListItem = MatchResult & {
  job: { id: number; source: JobSource; title: string; company: string | null; city: string }
}

export type ApplicationStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected' | 'withdrawn'

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Gespeichert',
  applied: 'Beworben',
  interview: 'Interview',
  offer: 'Zusage',
  rejected: 'Absage',
  withdrawn: 'Zurückgezogen',
}

export const OPEN_STATUSES: ApplicationStatus[] = ['saved', 'applied', 'interview']

export type ApplicationJob = { id: number; source: JobSource; title: string; company: string | null; city: string }

export type ApplicationSummary = {
  id: number
  status: ApplicationStatus
  created_at: string
  applied_at: string | null
  changed_at: string
  notes: number
  match_score: number | null
  job: ApplicationJob
}

export type ApplicationNote = { id: number; content: string; created_at: string }

export type Application = {
  id: number
  status: ApplicationStatus
  created_at: string
  match_score: number | null
  job: ApplicationJob & { offer_type: OfferType; full_time: boolean; part_time: boolean }
  history: { status: ApplicationStatus; changed_at: string }[]
  notes: ApplicationNote[]
}

export type InterviewDifficulty = 'easy' | 'medium' | 'hard'

export const INTERVIEW_DIFFICULTIES: InterviewDifficulty[] = ['easy', 'medium', 'hard']

export const INTERVIEW_DIFFICULTY_LABELS: Record<InterviewDifficulty, string> = {
  easy: 'Leicht',
  medium: 'Mittel',
  hard: 'Hoch',
}

export type InterviewTurn = {
  number: number
  title: string
  question: string
  gap: string | null
  ad_quote: string | null
  answer: string | null
  skipped: boolean
  score: number | null
  good: string | null
  better: string | null
  area: string | null
  line: string | null
}

export type InterviewArea = { area: string; average: number }

export type InterviewReport = {
  score: number
  strongest: InterviewArea
  weakest: InterviewArea | null
  recommendations: string[]
}

export type Interview = {
  id: number
  job: ApplicationJob
  difficulty: InterviewDifficulty
  status: 'running' | 'finished'
  question_count: number
  pending: boolean
  match_score: number | null
  created_at: string
  updated_at: string
  finished_at: string | null
  turns: InterviewTurn[]
  report: InterviewReport | null
}
