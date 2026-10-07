import { CvListSchema, CvSchema, ErrorResponseSchema, MAX_CV_BYTES } from '@job-match/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { TEST_DATABASE_URL, useTestDb } from './helpers';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n', 'latin1');

describe.skipIf(!TEST_DATABASE_URL)('profile', () => {
  const { app, signIn } = useTestDb();

  function post(headers: Record<string, string>, body: Buffer = PDF) {
    return request(app)
      .post('/api/cvs')
      .set(headers)
      .set('Content-Type', 'application/pdf')
      .send(body);
  }

  async function upload(headers: Record<string, string>) {
    const response = await post(headers);
    expect(response.status).toBe(201);
    return CvSchema.parse(response.body);
  }

  it('stores an upload as the active version and archives the old one', async () => {
    const anna = await signIn();

    const first = await upload(anna.headers);
    const second = await upload(anna.headers);
    const list = CvListSchema.parse((await request(app).get('/api/cvs').set(anna.headers)).body);

    expect(second).toMatchObject({ active: true, role: null, sizeBytes: PDF.length });
    expect(list.map((cv) => [cv.id, cv.active])).toEqual([
      [second.id, true],
      [first.id, false],
    ]);
  });

  it('stores the file name from the header and ignores an invalid one', async () => {
    const anna = await signIn();

    const named = await post(anna.headers).set(
      'X-File-Name',
      encodeURIComponent('Lebenslauf_Jürgen Müller.pdf'),
    );
    const broken = await post(anna.headers).set('X-File-Name', '%E0%A4%A');
    const without = await upload(anna.headers);

    expect(CvSchema.parse(named.body).fileName).toBe('Lebenslauf_Jürgen Müller.pdf');
    expect(CvSchema.parse(broken.body).fileName).toBeNull();
    expect(without.fileName).toBeNull();
  });

  it('rejects a file that is not a pdf with 415', async () => {
    const anna = await signIn();

    const text = await post(anna.headers, Buffer.from('Hallo, ich bin kein PDF'));
    const wrongType = await request(app)
      .post('/api/cvs')
      .set(anna.headers)
      .set('Content-Type', 'text/plain')
      .send(PDF.toString('latin1'));

    expect(text.status).toBe(415);
    expect(wrongType.status).toBe(415);
  });

  it('rejects a pdf larger than 5 MB with 413', async () => {
    const anna = await signIn();

    const response = await post(anna.headers, Buffer.concat([PDF, Buffer.alloc(MAX_CV_BYTES)]));

    expect(response.status).toBe(413);
    expect(ErrorResponseSchema.parse(response.body).error.code).toBe('payload_too_large');
  });

  it('returns the original pdf bytes', async () => {
    const anna = await signIn();
    const cv = await upload(anna.headers);

    const response = await request(app)
      .get(`/api/cvs/${cv.id}/pdf`)
      .set(anna.headers)
      .responseType('blob');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(Buffer.compare(response.body as Buffer, PDF)).toBe(0);
  });

  it('sets a role from the list and rejects an unknown role', async () => {
    const anna = await signIn();
    const cv = await upload(anna.headers);
    const url = `/api/cvs/${cv.id}`;

    const ok = await request(app).patch(url).set(anna.headers).send({ role: 'frontend' });
    const unknown = await request(app).patch(url).set(anna.headers).send({ role: 'astronaut' });

    expect(CvSchema.parse(ok.body).role).toBe('frontend');
    expect(unknown.status).toBe(400);
  });

  it('reactivates an archived version so that exactly one stays active', async () => {
    const anna = await signIn();
    const old = await upload(anna.headers);
    await upload(anna.headers);

    const response = await request(app).post(`/api/cvs/${old.id}/activate`).set(anna.headers);
    const list = CvListSchema.parse((await request(app).get('/api/cvs').set(anna.headers)).body);

    expect(CvSchema.parse(response.body).active).toBe(true);
    expect(list.filter((cv) => cv.active).map((cv) => cv.id)).toEqual([old.id]);
  });

  it('deletes one or several versions, including the active one', async () => {
    const anna = await signIn();
    const first = await upload(anna.headers);
    const second = await upload(anna.headers);
    const third = await upload(anna.headers);

    const one = await request(app)
      .post('/api/cvs/delete')
      .set(anna.headers)
      .send({ ids: [first.id] });
    const several = await request(app)
      .post('/api/cvs/delete')
      .set(anna.headers)
      .send({ ids: [second.id, third.id, third.id] });
    const list = await request(app).get('/api/cvs').set(anna.headers);

    expect(one.status).toBe(204);
    expect(several.status).toBe(204);
    expect(list.body).toEqual([]);
    expect((await request(app).get(`/api/cvs/${third.id}/pdf`).set(anna.headers)).status).toBe(404);
  });

  it('deletes nothing when one id is unknown and rejects an empty list', async () => {
    const anna = await signIn();
    const cv = await upload(anna.headers);

    const unknown = await request(app)
      .post('/api/cvs/delete')
      .set(anna.headers)
      .send({ ids: [cv.id, crypto.randomUUID()] });
    const empty = await request(app).post('/api/cvs/delete').set(anna.headers).send({ ids: [] });
    const list = CvListSchema.parse((await request(app).get('/api/cvs').set(anna.headers)).body);

    expect(unknown.status).toBe(404);
    expect(empty.status).toBe(400);
    expect(list.map((entry) => entry.id)).toEqual([cv.id]);
  });

  it('answers 404 for the cv of another user on every route', async () => {
    const anna = await signIn();
    const ben = await signIn();
    const cv = await upload(anna.headers);
    const url = `/api/cvs/${cv.id}`;

    expect((await request(app).get(`${url}/pdf`).set(ben.headers)).status).toBe(404);
    expect((await request(app).patch(url).set(ben.headers).send({ role: 'qa' })).status).toBe(404);
    expect((await request(app).post(`${url}/activate`).set(ben.headers)).status).toBe(404);
    expect(
      (
        await request(app)
          .post('/api/cvs/delete')
          .set(ben.headers)
          .send({ ids: [cv.id] })
      ).status,
    ).toBe(404);
    expect((await request(app).get('/api/cvs/kein-uuid/pdf').set(ben.headers)).status).toBe(404);
    expect((await request(app).get('/api/cvs').set(ben.headers)).body).toEqual([]);
  });

  it('requires a login', async () => {
    expect((await request(app).get('/api/cvs')).status).toBe(401);
  });
});
