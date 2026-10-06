import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import type { Db } from '../db';
import { jobs } from './jobs.tables';
import type { OfferType } from './jobs.tables';

const BA_URL = 'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service';
const BA_HEADERS = { 'X-API-Key': 'jobboerse-jobsuche' };
const BA_TIMEOUT_MS = 20_000;
const BA_ATTEMPTS = 3;
const PAGE_SIZE = 25;
const MAX_REACHABLE_RESULTS = 10_000;
const MAX_AGE_DAYS = 30;
const MIN_SALARY_YEAR = 15_000;
const MAX_SALARY_YEAR = 250_000;

const STATES = [
  'Baden-Württemberg',
  'Bayern',
  'Berlin',
  'Brandenburg',
  'Bremen',
  'Hamburg',
  'Hessen',
  'Mecklenburg-Vorpommern',
  'Niedersachsen',
  'Nordrhein-Westfalen',
  'Rheinland-Pfalz',
  'Saarland',
  'Sachsen',
  'Sachsen-Anhalt',
  'Schleswig-Holstein',
  'Thüringen',
];

const SALARY_FACTORS: Readonly<Record<string, number>> = {
  JAHRESGEHALT: 1,
  MONATSGEHALT: 12,
  STUNDENLOHN: 2080,
};

const OFFER_TYPES: Readonly<Record<string, OfferType>> = {
  ARBEIT: 'job',
  AUSBILDUNG: 'apprenticeship',
  PRAKTIKUM_TRAINEE: 'internship',
  SELBSTAENDIGKEIT: 'self_employed',
};

const SearchSchema = z.object({
  ergebnisliste: z.array(z.object({ referenznummer: z.string() })).default([]),
  maxErgebnisse: z.number().default(0),
});

const DetailSchema = z.object({
  referenznummer: z.string(),
  stellenangebotsTitel: z.string().min(1).optional(),
  firma: z.string(),
  hauptberuf: z.string().min(1).optional(),
  stellenangebotsart: z.string().optional(),
  stellenangebotsBeschreibung: z.string().min(1),
  stellenlokationen: z.tuple(
    [
      z.object({
        adresse: z.object({
          ort: z.string().optional(),
          region: z.string().optional(),
          plz: z.string().optional(),
        }),
        breite: z.number().optional(),
        laenge: z.number().optional(),
      }),
    ],
    z.unknown(),
  ),
  arbeitszeitVollzeit: z.boolean().optional(),
  arbeitszeitTeilzeitVormittag: z.boolean().optional(),
  arbeitszeitTeilzeitNachmittag: z.boolean().optional(),
  arbeitszeitTeilzeitAbend: z.boolean().optional(),
  arbeitszeitTeilzeitFlexibel: z.boolean().optional(),
  homeofficemoeglich: z.boolean().optional(),
  vertragsdauer: z.string().optional(),
  verguetungsangabe: z.string().optional(),
  gehaltsspanneVon: z.number().optional(),
  gehaltsspanneBis: z.number().optional(),
  festgehalt: z.number().optional(),
  istPrivateArbeitsvermittlung: z.boolean().optional(),
  istArbeitnehmerUeberlassung: z.boolean().optional(),
  externeURL: z.url().optional().catch(undefined),
  datumErsteVeroeffentlichung: z.iso.date(),
});

type BaJob = z.infer<typeof DetailSchema>;
export type NewJob = typeof jobs.$inferInsert;

export interface JobSearch {
  readonly what?: string;
  readonly where?: string;
  readonly limit: number;
}

export type ImportProgress = (done: number, total: number) => void;

async function fetchBaOnce(path: string): Promise<unknown> {
  const response = await fetch(`${BA_URL}${path}`, {
    headers: BA_HEADERS,
    signal: AbortSignal.timeout(BA_TIMEOUT_MS),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Bundesagentur antwortet mit Status ${response.status}.`);
  return response.json();
}

async function fetchBa(path: string): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchBaOnce(path);
    } catch (error) {
      if (attempt === BA_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
}

function anyTrue(values: readonly (boolean | undefined)[]) {
  const known = values.filter((value) => value !== undefined);
  return known.length === 0 ? null : known.some(Boolean);
}

function perYear(job: BaJob, amount: number | undefined) {
  const factor = SALARY_FACTORS[job.verguetungsangabe ?? ''];
  if (amount === undefined || factor === undefined) return null;
  const yearly = Math.round(amount * factor);
  return yearly >= MIN_SALARY_YEAR && yearly <= MAX_SALARY_YEAR ? yearly : null;
}

function permanent(contract: string | undefined) {
  if (contract === 'UNBEFRISTET') return true;
  if (contract === 'BEFRISTET') return false;
  return null;
}

export function toJob(raw: unknown): NewJob | null {
  const parsed = DetailSchema.safeParse(raw);
  if (!parsed.success) return null;
  const job = parsed.data;
  const [location] = job.stellenlokationen;
  const title = job.stellenangebotsTitel ?? job.hauptberuf;
  if (!title) return null;
  const partTime = anyTrue([
    job.arbeitszeitTeilzeitVormittag,
    job.arbeitszeitTeilzeitNachmittag,
    job.arbeitszeitTeilzeitAbend,
    job.arbeitszeitTeilzeitFlexibel,
  ]);
  const salaryClear = !(partTime === true && job.arbeitszeitVollzeit !== true);

  return {
    source: 'ba',
    externalId: job.referenznummer,
    offerType: OFFER_TYPES[job.stellenangebotsart ?? ''] ?? null,
    title,
    company: job.firma,
    occupation: job.hauptberuf ?? null,
    description: job.stellenangebotsBeschreibung,
    city: location.adresse.ort ?? null,
    region: location.adresse.region ?? null,
    postalCode: location.adresse.plz ?? null,
    latitude: location.breite ?? null,
    longitude: location.laenge ?? null,
    fullTime: job.arbeitszeitVollzeit ?? null,
    partTime,
    remote: job.homeofficemoeglich ?? null,
    permanent: permanent(job.vertragsdauer),
    salaryMinYear: salaryClear ? perYear(job, job.gehaltsspanneVon ?? job.festgehalt) : null,
    salaryMaxYear: salaryClear ? perYear(job, job.gehaltsspanneBis ?? job.festgehalt) : null,
    agency: anyTrue([job.istPrivateArbeitsvermittlung, job.istArbeitnehmerUeberlassung]),
    url:
      job.externeURL ??
      `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(job.referenznummer)}`,
    publishedAt: job.datumErsteVeroeffentlichung,
    raw,
  };
}

async function searchPage(what: string | undefined, where: string, page: number) {
  const params = new URLSearchParams({
    wo: where,
    page: String(page),
    size: String(PAGE_SIZE),
    veroeffentlichtseit: String(MAX_AGE_DAYS),
  });
  if (what) params.set('was', what);
  return SearchSchema.parse(await fetchBa(`/pc/v6/jobs?${params.toString()}`));
}

async function searchSpread(what: string | undefined, where: string, limit: number) {
  const first = await searchPage(what, where, 1);
  const reachable = Math.min(first.maxErgebnisse, MAX_REACHABLE_RESULTS);
  const pages = Math.ceil(reachable / PAGE_SIZE);
  const wanted = Math.min(pages, Math.ceil(limit / PAGE_SIZE));
  const results = [first];
  for (let index = 1; index < wanted; index++) {
    results.push(await searchPage(what, where, 1 + Math.floor((index * pages) / wanted)));
  }
  return results.flatMap((result) => result.ergebnisliste.map((job) => job.referenznummer));
}

async function searchJobIds(search: JobSearch) {
  const areas = search.where ? [search.where] : STATES.map((state) => `${state} (Bundesland)`);
  const share = Math.ceil(search.limit / areas.length);
  const ids = new Set<string>();
  for (const where of areas) {
    const found = await searchSpread(search.what, where, share);
    found.slice(0, share).forEach((id) => ids.add(id));
  }
  return [...ids].slice(0, search.limit);
}

function oldestPublishedAt() {
  const date = new Date();
  date.setDate(date.getDate() - MAX_AGE_DAYS);
  return date.toISOString().slice(0, 10);
}

async function knownJobIds(db: Db, ids: readonly string[]) {
  const rows = await db
    .select({ externalId: jobs.externalId })
    .from(jobs)
    .where(and(eq(jobs.source, 'ba'), inArray(jobs.externalId, [...ids])));
  return new Set(rows.map((row) => row.externalId));
}

export async function importJobs(db: Db, search: JobSearch, onProgress?: ImportProgress) {
  const ids = await searchJobIds(search);
  const known = await knownJobIds(db, ids);
  const missing = ids.filter((id) => !known.has(id));
  const oldest = oldestPublishedAt();
  let saved = 0;
  let invalid = 0;
  let tooOld = 0;
  let duplicate = 0;

  for (const [index, id] of missing.entries()) {
    onProgress?.(index, missing.length);
    const job = toJob(await fetchBa(`/pc/v4/jobdetails/${Buffer.from(id).toString('base64')}`));
    if (!job) {
      invalid++;
      continue;
    }
    if (job.publishedAt < oldest) {
      tooOld++;
      continue;
    }
    const inserted = await db
      .insert(jobs)
      .values(job)
      .onConflictDoNothing()
      .returning({ id: jobs.id });
    if (inserted.length === 0) duplicate++;
    else saved++;
  }

  return { found: ids.length, known: known.size, saved, invalid, tooOld, duplicate };
}
