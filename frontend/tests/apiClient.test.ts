import { afterEach, describe, it, expect, vi } from 'vitest';
import { ApiError, apiRequest, buildQuery } from '../src/api/client';
import { mockFetch } from './testUtils';

describe('API error handling', () => {
  afterEach(() => vi.restoreAllMocks());

  it('backend hata formatındaki mesaj ve kodu ApiError olarak fırlatmalı', async () => {
    mockFetch({ 'GET /api/sources/99': { status: 404, body: { error: { code: 'SOURCE_NOT_FOUND', message: 'İstenen kaynak bulunamadı.' } } } });

    const error = (await apiRequest('/api/sources/99').catch((err) => err)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
    expect(error.code).toBe('SOURCE_NOT_FOUND');
    expect(error.message).toBe('İstenen kaynak bulunamadı.');
  });

  it('doğrulama hatalarında ilk alan detayını mesaja eklemeli', async () => {
    mockFetch({ 'POST /api/crawls': { status: 422, body: { error: { code: 'VALIDATION_ERROR', message: 'İstek verileri doğrulanamadı.', details: [{ field: 'source_ids', message: 'En az bir kaynak gerekli' }] } } } });

    await expect(apiRequest('/api/crawls', { method: 'POST', body: '{}' })).rejects.toThrow('source_ids: En az bir kaynak gerekli');
  });

  it('ağ hatasında kullanıcı dostu mesaj üretmeli', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const error = (await apiRequest('/api/health').catch((err) => err)) as ApiError;
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).toMatch(/Sunucuya ulaşılamadı/);
  });

  it('boş filtreleri query string içine eklememeli', () => {
    expect(buildQuery({ level: 'ERROR', job_id: '', source: undefined, limit: 50 })).toBe('?level=ERROR&limit=50');
    expect(buildQuery({})).toBe('');
  });
});
