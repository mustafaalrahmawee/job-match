import { Writable } from 'node:stream';

import { expect, it } from 'vitest';

import { createLogger } from '../src/logger';

it('redacts passwords, contents and the authorization header', () => {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  const logger = createLogger('info', stream);

  logger.info({ password: 'geheim', content: 'Mein Lebenslauf', length: 15 }, 'eingang');
  logger.info({ body: { password: 'geheim', content: 'Text' } }, 'verschachtelt');
  logger.info(
    { req: { headers: { authorization: 'Bearer abc', 'x-file-name': 'Anna_Muster.pdf' } } },
    'anfrage',
  );
  logger.info({ token: 'opak-1', auth: { token: 'opak-2', passwordHash: 'hash-1' } }, 'konto');

  const output = lines.join('');
  expect(output).not.toContain('opak-1');
  expect(output).not.toContain('opak-2');
  expect(output).not.toContain('hash-1');
  expect(output).not.toContain('geheim');
  expect(output).not.toContain('Mein Lebenslauf');
  expect(output).not.toContain('Text');
  expect(output).not.toContain('Bearer abc');
  expect(output).not.toContain('Anna_Muster');
  expect(output).toContain('"length":15');
});
