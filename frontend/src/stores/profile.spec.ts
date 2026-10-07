import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api';

import { useProfileStore } from './profile';

const api = vi.hoisted(() => ({ apiJson: vi.fn(), apiUpload: vi.fn() }));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  apiJson: api.apiJson,
  apiUpload: api.apiUpload,
}));

const ID = '6f1c5d2e-8b0a-4c1e-9a53-0d2a7a1f3b11';
const cv = (analysisStatus: string) => ({
  id: ID,
  fileName: 'Lena.pdf',
  role: null,
  active: true,
  sizeBytes: 1000,
  createdAt: '2026-10-07T10:00:00.000Z',
  analysis: null,
  analysisStatus,
  analysisError: null,
});

describe('profile store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    api.apiJson.mockReset();
    api.apiUpload.mockReset();
  });

  it('starts the analysis right after the upload', async () => {
    api.apiUpload.mockResolvedValue(cv('none'));
    api.apiJson.mockImplementation((method: string) =>
      Promise.resolve(method === 'GET' ? [cv('none')] : cv('running')),
    );
    const profile = useProfileStore();

    await profile.upload(new File(['%PDF-1.4'], 'Lena.pdf', { type: 'application/pdf' }));

    expect(api.apiJson).toHaveBeenCalledWith('POST', `/api/cvs/${ID}/analysis`, expect.anything());
    expect(profile.analyzing).toBe(true);
  });

  it('keeps the error banner while polling quietly', async () => {
    api.apiJson.mockRejectedValueOnce(new ApiError(503, 'Die Analyse ist nicht verfügbar.'));
    const profile = useProfileStore();
    await profile.analyze(ID);

    api.apiJson.mockRejectedValueOnce(new Error('offline'));
    await profile.refresh();

    expect(profile.error).toBe('Die Analyse ist nicht verfügbar.');
  });
});
