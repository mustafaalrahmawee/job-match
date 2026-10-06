import { z } from 'zod';

import { loadConfig } from '../config';
import { createDatabase } from '../db';
import { importJobs } from './jobs.service';

const SearchSchema = z.object({
  what: z.string().trim().min(1),
  where: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});

const search = SearchSchema.safeParse({
  what: process.argv[2],
  where: process.argv[3],
  limit: process.argv[4],
});
if (!search.success) {
  console.error('Aufruf: pnpm jobs:import "<was>" ["<wo>"] [anzahl 1–1000, Standard 50]');
  process.exit(1);
}

const db = createDatabase(loadConfig().databaseUrl);
const result = await importJobs(db, search.data);
console.log(
  `Gefunden: ${result.found}, schon vorhanden: ${result.known}, ` +
    `neu gespeichert: ${result.saved}, älter als 30 Tage: ${result.tooOld}, ungültig: ${result.invalid}`,
);
await db.$client.end();
