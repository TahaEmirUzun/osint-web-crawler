import type { SourceCreate } from '../api/sourcesService';

export type FormErrors = Record<string, string>;

export const MAX_CRAWL_PAGES = 500;
export const MAX_CRAWL_DEPTH = 3;

export function validateSourceForm(form: SourceCreate): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = 'Kaynak adı zorunludur.';
  try {
    const url = new URL(form.base_url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') errors.base_url = 'Sadece http/https adresleri desteklenir.';
  } catch {
    errors.base_url = 'Geçerli bir URL girin (örn: https://vendor.com/security).';
  }
  if (!Number.isInteger(form.request_delay_seconds) || form.request_delay_seconds < 1 || form.request_delay_seconds > 60) {
    errors.request_delay_seconds = 'Gecikme 1-60 saniye arasında olmalıdır.';
  }
  const maxPages = form.maximum_pages ?? 0;
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > MAX_CRAWL_PAGES) {
    errors.maximum_pages = `Maksimum sayfa 1-${MAX_CRAWL_PAGES} arasında olmalıdır.`;
  }
  return errors;
}

export type CrawlFormValues = {
  selectedSourceIds: number[];
  maximumPages: number;
  maxDepth: number;
  dateFrom: string;
  keywords: string;
};

export function validateCrawlForm(form: CrawlFormValues, today: Date = new Date()): FormErrors {
  const errors: FormErrors = {};
  if (form.selectedSourceIds.length === 0) {
    errors.sources = 'Lütfen taranacak en az bir kaynak seçin.';
  }
  if (!Number.isInteger(form.maximumPages) || form.maximumPages < 1 || form.maximumPages > MAX_CRAWL_PAGES) {
    errors.maximumPages = `Maksimum sayfa 1-${MAX_CRAWL_PAGES} arasında olmalıdır.`;
  }
  if (!Number.isInteger(form.maxDepth) || form.maxDepth < 1 || form.maxDepth > MAX_CRAWL_DEPTH) {
    errors.maxDepth = `Tarama derinliği 1-${MAX_CRAWL_DEPTH} arasında olmalıdır.`;
  }
  if (form.dateFrom) {
    const selected = new Date(`${form.dateFrom}T00:00:00`);
    if (isNaN(selected.getTime())) {
      errors.dateFrom = 'Geçerli bir tarih seçin.';
    } else if (selected > today) {
      errors.dateFrom = 'Başlangıç tarihi gelecekte olamaz.';
    }
  }
  const keywords = parseKeywords(form.keywords);
  if (keywords.length > 20) {
    errors.keywords = 'En fazla 20 anahtar kelime girilebilir.';
  } else if (keywords.some(keyword => keyword.length > 100)) {
    errors.keywords = 'Anahtar kelimeler en fazla 100 karakter olabilir.';
  }
  return errors;
}

export function parseKeywords(value: string): string[] {
  return value.split(',').map(keyword => keyword.trim()).filter(keyword => keyword !== '');
}
