import { apiRequest } from './client';

export type CrawlStatus = 'queued' | 'running' | 'completed' | 'failed' | 'stopping' | 'stopped';

export type CrawlJob = {
  id: string; // Backend formatı: crawl_20260819_001
  status: CrawlStatus;
  started_date: string;
  completed_date: string | null;
  records_extracted: number;
  pages_visited: number;
  error_count: number;
  progress?: number;
  source_ids?: number[];
  source_names?: string[] | null;
  configuration?: Record<string, unknown> | null;
};

export type CrawlRequest = {
  source_ids: number[];
  maximum_pages?: number;
  max_depth?: number;
  date_from?: string;
  keywords?: string[];
};

export const ACTIVE_CRAWL_STATUSES: CrawlStatus[] = ['queued', 'running', 'stopping'];

// Backend rotası: GET /api/crawls
export async function getCrawlHistory(): Promise<CrawlJob[]> {
  return await apiRequest<CrawlJob[]>('/api/crawls');
}

// Backend rotası: GET /api/crawls/{job_id}
export async function getCrawlJob(jobId: string): Promise<CrawlJob> {
  return await apiRequest<CrawlJob>(`/api/crawls/${encodeURIComponent(jobId)}`);
}

// Backend rotası: POST /api/crawls
export async function startCrawl(payload: CrawlRequest): Promise<{ job_id: string; status: string }> {
  return await apiRequest<{ job_id: string; status: string }>('/api/crawls', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Çalışan bir tarama görevini durdurur
export async function stopCrawlJob(jobId: string): Promise<{ message: string; status: string }> {
  return await apiRequest<{ message: string; status: string }>(`/api/crawls/${encodeURIComponent(jobId)}/stop`, {
    method: 'POST',
  });
}
