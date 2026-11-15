import { ChromaClient, ChromaNotFoundError, ChromaUniqueError, type Collection, type Where } from 'chromadb'
import { ZodError } from 'zod'
import type { AnalysisStatus, Job } from '../../generated/prisma/client.js'
import { createEmbeddingClient, type Embed } from '../../llm/clients.js'
import type { CvAnalysis } from '../../prompts/cv_analysis/cv_analysis.schemas.js'
import * as config from './search.config.js'
import { cvMetadataSchema, jobMetadataSchema, type CvMetadata, type JobMetadata } from './search.schemas.js'
import { cvText, jobText } from './search.text.js'

export type IndexSettings = {
  storeGeneration: number
  listGeneration: number
  model: string
  dimensions: number
  retryDelayMs: number
}

export type CvSource = { id: number; userId: number; analysis: unknown }

export type JobSource = Pick<Job, 'id' | 'source' | 'userId' | 'role' | 'publishedAt' | 'title' | 'description'>

export type Entry = { id: string; text: string; metadata: CvMetadata | JobMetadata; document?: string }

export type Stores = { cvs: Collection; jobs: Collection }

export type Hit = { id: string; jobId: number; similarity: number }

export type Written = { written: Entry[]; failed: number }

export const INDEX_SETTINGS: IndexSettings = {
  storeGeneration: config.STORE_GENERATION,
  listGeneration: config.LIST_GENERATION,
  model: config.EMBED_MODEL,
  dimensions: config.EMBED_DIMENSIONS,
  retryDelayMs: config.EMBED_RETRY_DELAY_MS,
}

const PAGE_SIZE = 1000

export function createChromaClient(url: string): ChromaClient {
  const parsed = new URL(url)
  const ssl = parsed.protocol === 'https:'
  return new ChromaClient({ host: parsed.hostname, port: Number(parsed.port) || (ssl ? 443 : 80), ssl })
}

export function createSearchIndex(chromaUrl: string, ollamaUrl: string): SearchIndex {
  const embed = createEmbeddingClient({
    url: ollamaUrl,
    model: config.EMBED_MODEL,
    digest: config.EMBED_MODEL_DIGEST,
    numCtx: config.EMBED_NUM_CTX,
    timeoutMs: config.EMBED_TIMEOUT_MS,
  })
  return new SearchIndex(createChromaClient(chromaUrl), embed)
}

export function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export class SearchIndex {
  constructor(
    private readonly chroma: ChromaClient,
    private readonly embed: Embed,
    readonly settings: IndexSettings = INDEX_SETTINGS,
  ) { }

  async putCv(version: CvSource): Promise<void> {
    const started = performance.now()
    const id = `cv-${version.id}`
    try {
      const entry = this.cvEntry(version)
      if (entry === 'empty') return await this.remove(id)
      if (entry === null) return
      const { cvs } = await this.stores()
      const { written } = await this.write(cvs, [entry])
      if (written.length) console.info(`job_search: ${id} synced in ${Math.round(performance.now() - started)} ms`)
    } catch (error) {
      console.error(`job_search: ${id} not embedded: ${message(error)}`)
    }
  }

  async ensureCv(version: CvSource & { analysisStatus: AnalysisStatus }): Promise<void> {
    if (version.analysisStatus !== 'ready') return
    try {
      const { cvs } = await this.stores()
      const found = await cvs.get({ ids: [`cv-${version.id}`], include: [] })
      if (found.ids.length) return
    } catch (error) {
      console.error(`job_search: cv-${version.id} not embedded: ${message(error)}`)
      return
    }
    await this.putCv(version)
  }

  async putJob(job: JobSource, now = new Date()): Promise<void> {
    const started = performance.now()
    const id = `job-${job.id}`
    try {
      const entry = this.jobEntry(job, now)
      if (!entry) return
      const { jobs } = await this.stores()
      const { written } = await this.write(jobs, [entry.entry])
      if (written.length) console.info(`job_search: ${id} synced in ${Math.round(performance.now() - started)} ms`)
    } catch (error) {
      console.error(`job_search: ${id} not embedded: ${message(error)}`)
    }
  }

  async remove(id: string): Promise<void> {
    const started = performance.now()
    const prefix = id.startsWith('cv-') ? config.CV_STORE : config.JOB_STORE
    const generations = new Set([this.settings.storeGeneration, this.settings.listGeneration])
    try {
      for (const generation of generations) {
        const store = await this.existing(`${prefix}${generation}`)
        if (store) await store.delete({ ids: [id] })
      }
      console.info(`job_search: ${id} synced in ${Math.round(performance.now() - started)} ms`)
    } catch (error) {
      console.error(`job_search: ${id} not removed: ${message(error)}`)
    }
  }

  cvEntry(version: CvSource): Entry | 'empty' | null {
    const text = cvText(version.analysis as CvAnalysis)
    if (!text) {
      console.warn(`job_search: CV version ${version.id} has no text to embed`)
      return 'empty'
    }
    const id = `cv-${version.id}`
    const metadata = cvMetadataSchema.safeParse({ cvVersionId: version.id, userId: version.userId })
    if (!metadata.success) {
      console.error(`job_search: ${id} not embedded: ${metadataError(metadata.error)}`)
      return null
    }
    return { id, text, metadata: metadata.data }
  }

  jobEntry(job: JobSource, now = new Date()): { entry: Entry; hidden: boolean } | null {
    const id = `job-${job.id}`
    const { text, tagCharacters, hiddenElements } = jobText(job)
    const hidden = tagCharacters > 0 || hiddenElements > 0
    if (hidden) {
      console.warn(
        `job_search: ${id} hidden text: ${tagCharacters} tag characters, ${hiddenElements} hidden HTML elements`,
      )
    }
    if (!text) {
      console.warn(`job_search: job ${job.id} has no text to embed`)
      return null
    }
    const metadata = jobMetadataSchema(now).safeParse({
      jobId: job.id,
      source: job.source,
      ...(job.userId === null ? {} : { userId: job.userId }),
      role: job.role,
      publishedAt: Math.floor(job.publishedAt.getTime() / 1000),
    })
    if (!metadata.success) {
      console.error(`job_search: ${id} not embedded: ${metadataError(metadata.error)}`)
      return null
    }
    return { entry: { id, text, metadata: metadata.data, document: text }, hidden }
  }

  async write(store: Collection, entries: Entry[], progress = false): Promise<Written> {
    const written: Entry[] = []
    let failed = 0
    for (let start = 0; start < entries.length; start += config.EMBED_BATCH_SIZE) {
      const batch = entries.slice(start, start + config.EMBED_BATCH_SIZE)
      if (await this.attempt(store, batch)) {
        written.push(...batch)
      } else {
        for (const entry of batch) {
          try {
            await this.upsert(store, [entry])
            written.push(entry)
          } catch (error) {
            failed += 1
            console.error(`job_search: ${entry.id} not embedded: ${message(error)}`)
          }
        }
      }
      if (progress) console.info(`job_search: embedded ${written.length} of ${entries.length}`)
    }
    return { written, failed }
  }

  async stores(): Promise<Stores> {
    const generation = this.settings.storeGeneration
    return {
      cvs: await this.storeOf(`${config.CV_STORE}${generation}`),
      jobs: await this.storeOf(`${config.JOB_STORE}${generation}`),
    }
  }

  async listStores(): Promise<Stores> {
    const generation = this.settings.listGeneration
    if (generation === this.settings.storeGeneration) return this.stores()
    const names = [`${config.CV_STORE}${generation}`, `${config.JOB_STORE}${generation}`]
    const [cvs, jobs] = await Promise.all(names.map((name) => this.existing(name)))
    const missing = names.find((_, index) => ![cvs, jobs][index])
    if (missing || !cvs || !jobs) throw new Error(`job_search: store ${missing} missing`)
    if (
      cvs.metadata?.embedModel !== jobs.metadata?.embedModel ||
      cvs.metadata?.embedDimensions !== jobs.metadata?.embedDimensions
    ) {
      throw new Error(`job_search: stores of generation ${generation} differ`)
    }
    return { cvs, jobs }
  }

  async cvVector(versionId: number): Promise<{ embedding: number[]; metadata: CvMetadata } | null> {
    const { cvs } = await this.listStores()
    const found = await cvs.get<CvMetadata>({ ids: [`cv-${versionId}`], include: ['embeddings', 'metadatas'] })
    const embedding = found.embeddings[0]
    const metadata = found.metadatas[0]
    return embedding && metadata ? { embedding, metadata } : null
  }

  async query(store: Collection, vector: number[], where: Where, n: number): Promise<Hit[]> {
    const result = await store.query<JobMetadata>({
      queryEmbeddings: [vector],
      nResults: n,
      where,
      include: ['distances', 'metadatas'],
    })
    return result.ids[0].map((id, index) => ({
      id,
      jobId: result.metadatas[0][index]!.jobId,
      similarity: 1 - result.distances[0][index]!,
    }))
  }

  async ids(store: Collection, where?: Where): Promise<string[]> {
    const ids: string[] = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await store.get({ where, limit: PAGE_SIZE, offset, include: [] })
      ids.push(...page.ids)
      if (page.ids.length < PAGE_SIZE) return ids
    }
  }

  async collectionNames(): Promise<string[]> {
    const names: string[] = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await this.chroma.listCollections({ limit: PAGE_SIZE, offset })
      names.push(...page.map((collection) => collection.name))
      if (page.length < PAGE_SIZE) return names
    }
  }

  async dropStore(name: string): Promise<void> {
    await this.chroma.deleteCollection({ name })
  }

  private async attempt(store: Collection, batch: Entry[]): Promise<boolean> {
    for (let attempt = 1; attempt <= config.EMBED_ATTEMPTS; attempt++) {
      try {
        await this.upsert(store, batch)
        return true
      } catch {
        if (attempt < config.EMBED_ATTEMPTS) await new Promise((done) => setTimeout(done, this.settings.retryDelayMs))
      }
    }
    return false
  }

  private async upsert(store: Collection, batch: Entry[]): Promise<void> {
    const vectors = await this.embed(batch.map((entry) => entry.text))
    if (vectors.length !== batch.length) throw new Error(`expected ${batch.length} embeddings, got ${vectors.length}`)
    const embeddings = vectors.map((vector) => {
      const values = Array.isArray(vector) ? (vector as unknown[]) : []
      if (values.length !== this.settings.dimensions) {
        throw new Error(`embedding has ${values.length} dimensions, expected ${this.settings.dimensions}`)
      }
      if (!values.every((value) => typeof value === 'number' && Number.isFinite(value))) {
        throw new Error('embedding contains a non-finite value')
      }
      return values as number[]
    })
    const documents = batch.flatMap((entry) => (entry.document === undefined ? [] : [entry.document]))
    await store.upsert({
      ids: batch.map((entry) => entry.id),
      embeddings,
      metadatas: batch.map((entry) => entry.metadata),
      documents: documents.length === batch.length ? documents : undefined,
    })
  }

  private async storeOf(name: string): Promise<Collection> {
    let store = await this.existing(name)
    if (!store) {
      try {
        store = await this.chroma.createCollection({
          name,
          embeddingFunction: null,
          metadata: { embedModel: this.settings.model, embedDimensions: this.settings.dimensions },
          configuration: {
            hnsw: { space: 'cosine', ef_search: config.HNSW_EF_SEARCH, ef_construction: config.HNSW_EF_CONSTRUCTION },
          },
        })
      } catch (error) {
        if (!(error instanceof ChromaUniqueError)) throw error
        store = await this.chroma.getCollection({ name })
      }
    }
    const { embedModel, embedDimensions } = (store.metadata ?? {}) as { embedModel?: string; embedDimensions?: number }
    if (embedModel !== this.settings.model || embedDimensions !== this.settings.dimensions) {
      throw new Error(
        `job_search: store ${name} holds ${String(embedModel)}/${String(embedDimensions)}, expected ${this.settings.model}/${this.settings.dimensions}`,
      )
    }
    return store
  }

  private async existing(name: string): Promise<Collection | null> {
    try {
      return await this.chroma.getCollection({ name })
    } catch (error) {
      if (error instanceof ChromaNotFoundError) return null
      throw error
    }
  }
}

function metadataError(error: ZodError): string {
  const issue = error.issues[0]
  return `invalid metadata: ${issue.code === 'unrecognized_keys' ? issue.keys.join(', ') : issue.path.join('.')}`
}
