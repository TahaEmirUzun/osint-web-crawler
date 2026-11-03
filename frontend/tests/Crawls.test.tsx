import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import Crawls from '../src/pages/Crawls';
import { mockFetch, sampleSources } from './testUtils';

const runningJob = {
  id: 'crawl_20261103_001', status: 'running', progress: 45, pages_visited: 90, records_extracted: 37,
  error_count: 2, started_date: '2026-11-03T10:00:00', completed_date: null, source_ids: [1], source_names: ['Ubuntu Security Notices'],
};

describe('Crawls page', () => {
  afterEach(() => vi.restoreAllMocks());

  it('Crawl progress display: çalışan görevin ilerlemesini göstermeli', async () => {
    mockFetch({ 'GET /api/crawls': [runningJob], 'GET /api/sources': sampleSources });
    render(<Crawls />);

    const progress = await screen.findByRole('progressbar', { name: 'crawl_20261103_001 ilerlemesi' });
    expect(progress).toHaveAttribute('aria-valuenow', '45');
    expect(screen.getByText('%45')).toBeInTheDocument();
    expect(screen.getByText('Çalışıyor')).toBeInTheDocument();
    expect(screen.getByText('Ubuntu Security Notices')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'crawl_20261103_001 görevini durdur' })).toBeInTheDocument();
  });

  it('Crawl form validation: kaynak seçilmeden tarama başlatılamamalı', async () => {
    const { calls } = mockFetch({ 'GET /api/crawls': [], 'GET /api/sources': sampleSources, 'POST /api/crawls': { status: 202, body: { job_id: 'x', status: 'queued' } } });
    render(<Crawls />);

    fireEvent.click(await screen.findByRole('button', { name: /Yeni Tarama Başlat/ }));
    const dialog = screen.getByRole('dialog');
    within(dialog).getAllByRole('checkbox').forEach(checkbox => fireEvent.click(checkbox));
    fireEvent.change(within(dialog).getByLabelText('Maksimum Sayfa'), { target: { value: '0' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Taramayı Başlat/ }));

    expect(await within(dialog).findByText('Lütfen taranacak en az bir kaynak seçin.')).toBeInTheDocument();
    expect(within(dialog).getByText(/Maksimum sayfa 1-500/)).toBeInTheDocument();
    expect(calls.some(call => call.method === 'POST')).toBe(false);
  });

  it('geçerli form REST API üzerinden taramayı başlatmalı', async () => {
    const { calls } = mockFetch({ 'GET /api/crawls': [], 'GET /api/sources': sampleSources, 'POST /api/crawls': { status: 202, body: { job_id: 'crawl_20261103_002', status: 'queued' } } });
    render(<Crawls />);

    fireEvent.click(await screen.findByRole('button', { name: /Yeni Tarama Başlat/ }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Anahtar Kelimeler/), { target: { value: 'critical, rce' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Taramayı Başlat/ }));

    await vi.waitFor(() => expect(calls.find(call => call.method === 'POST')).toBeTruthy());
    expect(calls.find(call => call.method === 'POST')?.body).toEqual({ source_ids: [1, 2], maximum_pages: 100, max_depth: 2, keywords: ['critical', 'rce'] });
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Loading state: veriler gelene kadar yükleniyor mesajı göstermeli', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
    render(<Crawls />);
    expect(screen.getByText('Veriler yükleniyor...')).toBeInTheDocument();
  });
});
