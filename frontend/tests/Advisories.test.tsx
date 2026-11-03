import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import Advisories from '../src/pages/Advisories';
import { mockFetch, sampleAdvisories } from './testUtils';

const rowTitles = () => screen.getAllByRole('row').slice(1).map(row => within(row).getAllByRole('cell')[1]?.textContent);

describe('Advisory table', () => {
  afterEach(() => vi.restoreAllMocks());

  it('Advisory table filtering: kritiklik ve kurum filtresi uygulanmalı', async () => {
    mockFetch({ 'GET /api/advisories': sampleAdvisories });
    render(<Advisories />);

    expect(await screen.findByText('Critical OpenSSL RCE')).toBeInTheDocument();
    expect(rowTitles()).toHaveLength(3);

    fireEvent.change(screen.getByLabelText('Kritiklik'), { target: { value: 'Critical' } });
    expect(rowTitles()).toEqual(['Critical OpenSSL RCE']);

    fireEvent.change(screen.getByLabelText('Kritiklik'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Kurum'), { target: { value: 'Canonical (Ubuntu)' } });
    expect(rowTitles()).toEqual(['Ubuntu kernel update']);
  });

  it('anahtar kelime araması ve tarih filtresi çalışmalı', async () => {
    mockFetch({ 'GET /api/advisories': sampleAdvisories });
    render(<Advisories />);
    await screen.findByText('Critical OpenSSL RCE');

    fireEvent.change(screen.getByLabelText('Arama'), { target: { value: 'cve-2026-2222' } });
    expect(rowTitles()).toEqual(['Ubuntu kernel update']);

    fireEvent.change(screen.getByLabelText('Arama'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Başlangıç Tarihi'), { target: { value: '2026-01-01' } });
    expect(rowTitles()).toEqual(['Critical OpenSSL RCE', 'Ubuntu kernel update']);

    fireEvent.click(screen.getByRole('button', { name: /Filtreleri Temizle/ }));
    expect(rowTitles()).toHaveLength(3);
  });

  it('sütun başlığına tıklanınca sıralama değişmeli', async () => {
    mockFetch({ 'GET /api/advisories': sampleAdvisories });
    render(<Advisories />);
    await screen.findByText('Critical OpenSSL RCE');

    fireEvent.click(screen.getByRole('button', { name: /Zafiyet Başlığı/ }));
    expect(rowTitles()).toEqual(['Ubuntu kernel update', 'PostgreSQL low impact bug', 'Critical OpenSSL RCE']);
    fireEvent.click(screen.getByRole('button', { name: /Zafiyet Başlığı/ }));
    expect(rowTitles()).toEqual(['Critical OpenSSL RCE', 'PostgreSQL low impact bug', 'Ubuntu kernel update']);
  });

  it('güvenli olmayan bağlantıları tıklanabilir yapmamalı, güvenlileri yeni sekmede açmalı', async () => {
    mockFetch({ 'GET /api/advisories': sampleAdvisories });
    render(<Advisories />);
    await screen.findByText('Critical OpenSSL RCE');

    fireEvent.click(screen.getByRole('button', { name: 'PostgreSQL low impact bug detaylarını incele' }));
    expect(screen.queryByRole('link', { name: /Orijinal Kaynağa Git/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Kaynak bağlantısı güvenli değil/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Detay penceresini kapat' }));

    fireEvent.click(screen.getByRole('button', { name: 'Critical OpenSSL RCE detaylarını incele' }));
    const link = screen.getByRole('link', { name: /Orijinal Kaynağa Git/ });
    expect(link).toHaveAttribute('href', 'https://www.openssl.org/news/a');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('API hatasında hata mesajı ve boş durumda bilgi mesajı göstermeli', async () => {
    mockFetch({ 'GET /api/advisories': { status: 503, body: { error: { code: 'SERVICE_UNAVAILABLE', message: 'Servis kullanılamıyor.' } } } });
    const { unmount } = render(<Advisories />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Servis kullanılamıyor.');
    unmount();
    vi.restoreAllMocks();

    mockFetch({ 'GET /api/advisories': [] });
    render(<Advisories />);
    expect(await screen.findByText(/Henüz toplanmış zafiyet yok/)).toBeInTheDocument();
  });
});
