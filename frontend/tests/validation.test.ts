import { describe, it, expect } from 'vitest';
import { parseKeywords, validateCrawlForm, validateSourceForm } from '../src/utils/validation';

const validCrawl = { selectedSourceIds: [1, 2], maximumPages: 100, maxDepth: 2, dateFrom: '', keywords: '' };

describe('Crawl form validation', () => {
  it('geçerli formu kabul etmeli', () => {
    expect(validateCrawlForm(validCrawl)).toEqual({});
  });

  it('kaynak seçilmemiş, sayfa/derinlik aralık dışı ve gelecekteki tarihi reddetmeli', () => {
    const errors = validateCrawlForm(
      { selectedSourceIds: [], maximumPages: -5, maxDepth: 9, dateFrom: '2099-01-01', keywords: '' },
      new Date('2026-11-03T12:00:00'),
    );
    expect(Object.keys(errors).sort()).toEqual(['dateFrom', 'maxDepth', 'maximumPages', 'sources']);
  });

  it('anahtar kelimeleri virgülle ayırıp boşlukları temizlemeli', () => {
    expect(parseKeywords(' critical, rce ,, remote code execution ')).toEqual(['critical', 'rce', 'remote code execution']);
  });
});

describe('Source form validation', () => {
  it('geçersiz URL ve gecikmeyi reddetmeli', () => {
    const errors = validateSourceForm({ name: '', base_url: 'ftp://example.com', enabled: true, request_delay_seconds: 0, maximum_pages: 100 });
    expect(Object.keys(errors).sort()).toEqual(['base_url', 'name', 'request_delay_seconds']);
  });
});
