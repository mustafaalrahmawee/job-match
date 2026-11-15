export const TOP_K = 20

export const EMBED_MODEL = 'jina-embeddings-v2-base-de:f9b10d7e24af'
export const EMBED_MODEL_DIGEST = 'f9b10d7e24af884e67395619df27c20591879734d9451ed2122335f83441d6fa'
export const EMBED_NUM_CTX = 8192
export const EMBED_DIMENSIONS = 768
export const EMBED_BATCH_SIZE = 4
export const EMBED_TIMEOUT_MS = 90_000
export const EMBED_ATTEMPTS = 3
export const EMBED_RETRY_DELAY_MS = 2000

export const STORE_GENERATION = 1
export const LIST_GENERATION = 1

export const HNSW_EF_SEARCH = 1000
export const HNSW_EF_CONSTRUCTION = 400

export const CV_STORE = 'job_search_cvs_'
export const JOB_STORE = 'job_search_jobs_'

export const SYNC_CHECK_ENTRIES = 5
export const SWITCH_CHECK_ENTRIES = 20
export const SLOW_LIST_MS = 1000

export const CV_LABELS = {
  positions: 'Stationen: ',
  skills: 'Kenntnisse: ',
  degrees: 'Abschlüsse: ',
  languages: 'Sprachen: ',
} as const

export const UNREADABLE = '[nicht lesbar]'
export const EMAIL_PLACEHOLDER = '[E-Mail]'

export const HTML_ENTITIES = new Map([
  ['amp', '&'],
  ['nbsp', ' '],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
  ['ndash', '–'],
  ['mdash', '—'],
])

export const BLOCK_TAGS = new Set([
  'p',
  'div',
  'br',
  'li',
  'ul',
  'ol',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'tr',
  'table',
  'blockquote',
  'pre',
])

export const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'wbr'])
