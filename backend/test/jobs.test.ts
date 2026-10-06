import { readFileSync } from 'node:fs';

import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDatabase } from '../src/db';
import { importJobs, toJob } from '../src/jobs/jobs.service';
import { jobs } from '../src/jobs/jobs.tables';
import { TEST_DATABASE_URL } from './helpers';

interface BaDetail {
  readonly referenznummer: string;
  readonly [field: string]: unknown;
}

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8'));
}

const search = fixture('ba-search.json');
const details = fixture('ba-details.json') as BaDetail[];
const ids = [...details.map((detail) => detail.referenznummer), 'kopie-1', 'kopie-2'];
const fetchedOn = new Date('2026-10-06T12:00:00Z');
const recent = details.filter(
  (detail) => String(detail.datumErsteVeroeffentlichung) >= '2026-09-06',
);

function detailWith(field: string, value: unknown) {
  const detail = details.find((candidate) => candidate[field] === value);
  if (!detail) throw new Error(`Kein Beispiel mit ${field} = ${String(value)}`);
  return detail;
}

function fakeBa(url: string) {
  const path = new URL(url).pathname;
  if (path.endsWith('/pc/v6/jobs')) return Response.json(search);
  const id = Buffer.from(path.split('/').at(-1) ?? '', 'base64').toString();
  const detail = details.find((candidate) => candidate.referenznummer === id);
  return detail ? Response.json(detail) : new Response(null, { status: 404 });
}

describe('toJob', () => {
  it('maps every example job of the Bundesagentur', () => {
    expect(details.map(toJob).filter((job) => job === null)).toHaveLength(0);
  });

  it('converts salaries to euros per year', () => {
    const yearly = toJob(detailWith('gehaltsspanneVon', 40000));
    const hourly = toJob(detailWith('gehaltsspanneVon', 34.07));

    expect(yearly).toMatchObject({ salaryMinYear: 40000 });
    expect(hourly).toMatchObject({ salaryMinYear: 70866, salaryMaxYear: 72946 });
  });

  it('drops salaries that are unclear or implausible', () => {
    const base = {
      ...details[0],
      arbeitszeitVollzeit: true,
      verguetungsangabe: 'MONATSGEHALT',
      gehaltsspanneVon: undefined,
      festgehalt: 3000,
    };
    const partTimeOnly = { arbeitszeitVollzeit: false, arbeitszeitTeilzeitVormittag: true };

    expect(toJob(base)?.salaryMinYear).toBe(36000);
    expect(toJob({ ...base, ...partTimeOnly })?.salaryMinYear).toBeNull();
    expect(toJob({ ...base, festgehalt: 538 })?.salaryMinYear).toBeNull();
  });

  it('keeps missing details unknown instead of false', () => {
    const job = toJob({ ...detailWith('homeofficemoeglich', true), homeofficemoeglich: undefined });

    expect(job?.remote).toBeNull();
    expect(toJob(detailWith('vertragsdauer', 'KEINE_ANGABE'))?.permanent).toBeNull();
  });

  it('marks agencies and temporary work', () => {
    expect(toJob(detailWith('istPrivateArbeitsvermittlung', true))?.agency).toBe(true);
    expect(toJob(detailWith('istArbeitnehmerUeberlassung', true))?.agency).toBe(true);
  });

  it('links to the Bundesagentur when the ad has no own link', () => {
    const detail = details.find((candidate) => candidate.externeURL === undefined);

    expect(toJob(detail)?.url).toBe(
      `https://www.arbeitsagentur.de/jobsuche/jobdetail/${detail?.referenznummer}`,
    );
  });

  it('keeps the first location when later ones have no city', () => {
    const [first] = details;
    const job = toJob({
      ...first,
      stellenlokationen: [{ adresse: { ort: 'Berlin' } }, { adresse: { region: 'BAYERN' } }],
    });

    expect(job).toMatchObject({ city: 'Berlin', region: null, latitude: null });
  });

  it('keeps a job that names only a region and no occupation', () => {
    const job = toJob({
      ...details[0],
      hauptberuf: undefined,
      stellenlokationen: [{ adresse: { region: 'BAYERN', land: 'DEUTSCHLAND' } }],
    });

    expect(job).toMatchObject({ occupation: null, city: null, region: 'BAYERN' });
  });

  it('uses the occupation as title when the ad has none', () => {
    const job = toJob({
      ...details[0],
      stellenangebotsTitel: undefined,
      hauptberuf: 'Koch/Köchin',
    });
    const neither = toJob({
      ...details[0],
      stellenangebotsTitel: undefined,
      hauptberuf: undefined,
    });

    expect(job?.title).toBe('Koch/Köchin');
    expect(neither).toBeNull();
  });

  it('maps the offer type and keeps unknown types unknown', () => {
    expect(toJob({ ...details[0], stellenangebotsart: 'AUSBILDUNG' })?.offerType).toBe(
      'apprenticeship',
    );
    expect(toJob({ ...details[0], stellenangebotsart: 'NEU' })?.offerType).toBeNull();
  });

  it('rejects a job without description', () => {
    expect(toJob({ ...details[0], stellenangebotsBeschreibung: '' })).toBeNull();
  });
});

describe.skipIf(!TEST_DATABASE_URL)('importJobs', () => {
  const db = createDatabase(TEST_DATABASE_URL ?? '');
  const removeExamples = () =>
    db.delete(jobs).where(and(eq(jobs.source, 'ba'), inArray(jobs.externalId, ids)));

  beforeAll(removeExamples);
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  afterAll(async () => {
    await removeExamples();
    await db.$client.end();
  });

  it('saves recent jobs once and skips them on the next import', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: fetchedOn });
    const fetch = vi.fn((url: string) => Promise.resolve(fakeBa(url)));
    vi.stubGlobal('fetch', fetch);
    const old = details.length - recent.length;

    const first = await importJobs(db, { what: 'Entwickler', where: 'Berlin', limit: 20 });
    const second = await importJobs(db, { what: 'Entwickler', where: 'Berlin', limit: 20 });

    expect(first).toMatchObject({ found: 20, known: 0, saved: recent.length, tooOld: old });
    expect(second).toMatchObject({ found: 20, known: recent.length, saved: 0, tooOld: old });
    expect(String(fetch.mock.calls[0]?.[0])).toContain('veroeffentlichtseit=30');
    expect(fetch).toHaveBeenCalledTimes(2 + 20 + old);
  });

  it('searches every state without a keyword and retries a failed request', async () => {
    const fetch = vi
      .fn((url: string) => Promise.resolve(fakeBa(url)))
      .mockRejectedValueOnce(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetch);

    await importJobs(db, { limit: 16 });

    const searches = fetch.mock.calls
      .map(([url]) => new URL(url))
      .filter((url) => url.pathname.endsWith('/pc/v6/jobs'));
    expect(searches.some((url) => url.searchParams.has('was'))).toBe(false);
    const states = new Set(searches.map((url) => url.searchParams.get('wo')));
    expect(states.size).toBe(16);
    expect(states.has('Hessen (Bundesland)')).toBe(true);
  });

  it('spreads the search over all reachable pages', async () => {
    const fetch = vi.fn((_url: string) =>
      Promise.resolve(Response.json({ maxErgebnisse: 50_000 })),
    );
    vi.stubGlobal('fetch', fetch);

    await importJobs(db, { where: 'Bayern', limit: 100 });

    const pages = fetch.mock.calls.map(([url]) => new URL(url).searchParams.get('page'));
    expect(pages).toEqual(['1', '101', '201', '301']);
  });

  it('skips a job whose company already has the same text', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: fetchedOn });
    const copy = { ...recent[0], stellenangebotsBeschreibung: 'Gleicher Text bei zwei Stellen' };
    vi.stubGlobal('fetch', (url: string) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/pc/v6/jobs')) {
        return Promise.resolve(
          Response.json({
            maxErgebnisse: 2,
            ergebnisliste: [{ referenznummer: 'kopie-1' }, { referenznummer: 'kopie-2' }],
          }),
        );
      }
      const id = Buffer.from(path.split('/').at(-1) ?? '', 'base64').toString();
      return Promise.resolve(Response.json({ ...copy, referenznummer: id }));
    });

    const result = await importJobs(db, { where: 'Berlin', limit: 5 });

    expect(result).toMatchObject({ found: 2, saved: 1, duplicate: 1 });
  });
});
