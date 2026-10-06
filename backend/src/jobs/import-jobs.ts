import { z } from 'zod';

import { loadConfig } from '../config';
import { createDatabase } from '../db';
import { importJobs } from './jobs.service';

const SearchSchema = z.object({
  limit: z.coerce.number().int().min(1).max(10_000),
  what: z.string().trim().min(1).optional(),
  where: z.string().trim().min(1).optional(),
});

const search = SearchSchema.safeParse({
  limit: process.argv[2],
  what: process.argv[3],
  where: process.argv[4],
});
if (!search.success) {
  console.error('Aufruf: pnpm jobs:import <anzahl 1–10000> ["<was>"] ["<wo>"]');
  process.exit(1);
}

const db = createDatabase(loadConfig().databaseUrl);
const result = await importJobs(db, search.data, (done, total) => {
  if (done % 100 === 0) console.log(`Details geladen: ${done} von ${total}`);
});
console.log(
  `Gefunden: ${result.found}, schon vorhanden: ${result.known}, ` +
    `neu gespeichert: ${result.saved}, älter als 30 Tage: ${result.tooOld}, ungültig: ${result.invalid}`,
);
await db.$client.end();
