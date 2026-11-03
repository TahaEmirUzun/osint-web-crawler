import { render, screen } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import Dashboard from '../src/pages/Dashboard';
import { mockFetch, sampleAdvisories } from './testUtils';

const summary = {
  total_advisories: 425, critical: 38, high: 124, medium: 190, low: 73,
  active_sources: 6, completed_crawls: 14, failed_crawls: 2,
};

describe('Dashboard Component Rendering Test', () => {
  afterEach(() => vi.restoreAllMocks());

  it('başlangıçta yükleniyor (loading) durumunu ekrana basmalıdır', () => {
    mockFetch({ 'GET /api/statistics/summary': summary, 'GET /api/statistics/timeline': [], 'GET /api/advisories': [] });
    render(<Dashboard />);
    expect(screen.getByText(/Veriler yükleniyor/i)).toBeInTheDocument();
  });

  it('API verisiyle metrik kartlarını ve son zafiyetleri göstermelidir', async () => {
    mockFetch({
      'GET /api/statistics/summary': summary,
      'GET /api/statistics/timeline': [{ date: '2026-08-02', count: 3 }],
      'GET /api/advisories': sampleAdvisories,
    });
    render(<Dashboard />);

    expect(await screen.findByText('Gösterge Paneli')).toBeInTheDocument();
    expect(screen.getByText('425')).toBeInTheDocument();
    expect(screen.getByText('Başarısız Taramalar')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Critical OpenSSL RCE')).toBeInTheDocument();
    expect(screen.getByText(/Son güncelleme/)).toBeInTheDocument();
  });

  it('API hatasında anlaşılır bir hata mesajı göstermelidir', async () => {
    mockFetch({ 'GET /api/statistics/summary': { status: 500, body: { error: { code: 'INTERNAL_SERVER_ERROR', message: 'Sunucuda beklenmeyen bir hata oluştu.' } } } });
    render(<Dashboard />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Sunucuda beklenmeyen bir hata oluştu.');
    expect(screen.getByRole('button', { name: 'Tekrar Dene' })).toBeInTheDocument();
  });
});
