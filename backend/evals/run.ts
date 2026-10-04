const UNITS: Readonly<Record<string, () => Promise<{ main(args: string[]): Promise<number> }>>> = {
  coach_chat: () => import('./coach_chat/run'),
};

const unit = process.argv[2] ?? '';
const load = Object.hasOwn(UNITS, unit) ? UNITS[unit] : undefined;
if (!load) {
  console.error(
    `Aufruf: pnpm eval <prompt-unit> <fassung>\nVorhanden: ${Object.keys(UNITS).join(', ')}`,
  );
  process.exitCode = 1;
} else {
  process.exitCode = await (await load()).main(process.argv.slice(3));
}
