import { vi } from 'vitest';

type RouteHandler = unknown | ((init?: RequestInit) => unknown);
type MockRoute = { status?: number; body: RouteHandler } | RouteHandler;

export type FetchCall = { method: string; path: string; body?: unknown };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/**
 * fetch çağrılarını "METHOD /path" anahtarlarıyla eşleştirip sahte yanıt döndürür.
 * Örn: { 'GET /api/sources': [...], 'POST /api/crawls': { status: 202, body: {...} } }
 */
export function mockFetch(routes: Record<string, MockRoute>) {
  const calls: FetchCall[] = [];
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method || 'GET').toUpperCase();
    const path = url.pathname.replace(/\/$/, '');
    calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });

    const route = routes[`${method} ${path}`];
    if (route === undefined) {
      return jsonResponse(404, { error: { code: 'NOT_FOUND', message: `Mock bulunamadı: ${method} ${path}` } });
    }
    if (route instanceof Error) throw route;

    const isWrapped = typeof route === 'object' && route !== null && 'body' in route && !Array.isArray(route);
    const status = isWrapped ? ((route as { status?: number }).status ?? 200) : 200;
    let body = isWrapped ? (route as { body: RouteHandler }).body : route;
    if (typeof body === 'function') body = (body as (init?: RequestInit) => unknown)(init);
    return jsonResponse(status, body);
  });
  return { spy, calls };
}

export const sampleSources = [
  { id: 1, name: 'Ubuntu Security Notices', base_url: 'https://ubuntu.com/security/notices', enabled: true, request_delay_seconds: 2, maximum_pages: 100 },
  { id: 2, name: 'PostgreSQL Security', base_url: 'https://www.postgresql.org/support/security/', enabled: true, request_delay_seconds: 2, maximum_pages: 100 },
];

export const sampleAdvisories = [
  { id: 3, title: 'Critical OpenSSL RCE', organization: 'OpenSSL Project', publication_date: '2026-08-01T00:00:00', url: 'https://www.openssl.org/news/a', source_domain: 'https://www.openssl.org/news/vulnerabilities.html', cve: 'CVE-2026-1111', product: 'OpenSSL', severity: 'Critical', summary: 'Remote code execution', collection_date: '2026-08-02T10:00:00', crawl_job_id: 'crawl_20260802_001' },
  { id: 2, title: 'Ubuntu kernel update', organization: 'Canonical (Ubuntu)', publication_date: '2026-07-15T00:00:00', url: 'https://ubuntu.com/security/notices/USN-1', source_domain: 'https://ubuntu.com/security/notices', cve: 'CVE-2026-2222', product: 'Ubuntu Linux', severity: 'High', summary: 'Kernel issue', collection_date: '2026-08-02T10:00:00', crawl_job_id: 'crawl_20260802_001' },
  { id: 1, title: 'PostgreSQL low impact bug', organization: 'PostgreSQL Global Development Group', publication_date: '2025-12-01T00:00:00', url: 'javascript:alert(1)', source_domain: 'https://www.postgresql.org/support/security/', cve: 'CVE-2025-3333', product: 'PostgreSQL Database', severity: 'Low', summary: 'Minor issue', collection_date: '2026-08-01T10:00:00', crawl_job_id: 'crawl_20260801_001' },
];
