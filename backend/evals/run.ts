/**
 * `pnpm eval <prompt-unit>` – startet die Beispiel-Suite einer Prompt-Unit (docs/STACK.md §7).
 * Ruft das **echte** Modell auf und kostet Geld: nur von Hand, nie in CI.
 */
const UNITS: Readonly<Record<string, () => Promise<{ main(): Promise<number> }>>> = {
  coach_chat: () => import('./coach_chat/run'),
};

const unit = process.argv[2] ?? '';
const load = Object.hasOwn(UNITS, unit) ? UNITS[unit] : undefined;
if (!load) {
  console.error(`Aufruf: pnpm eval <prompt-unit>\nVorhanden: ${Object.keys(UNITS).join(', ')}`);
  process.exitCode = 1;
} else {
  process.exitCode = await (await load()).main();
}
