import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';

import { z } from 'zod';

import { loadConfig } from '../config';
import { createDatabase } from '../db';
import { setPassword } from './auth.service';

const AccountSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(10).max(128),
});

const readline = createInterface({ input: stdin, output: stdout });
const password = await readline.question('Passwort (mindestens 10 Zeichen): ');
readline.close();

const input = AccountSchema.safeParse({ email: process.argv[2], password });
if (!input.success) {
  console.error('Aufruf: pnpm user:create <email> – gültige E-Mail, Passwort 10–128 Zeichen.');
  process.exit(1);
}

const db = createDatabase(loadConfig().databaseUrl);
const user = await setPassword(db, input.data.email, input.data.password);
console.log(`Konto gespeichert: ${user.email}`);
await db.$client.end();
