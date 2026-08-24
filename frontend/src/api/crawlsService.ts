import { apiRequest } from './client';

export type CrawlJob = {
  id: string; // Backend formatı: crawl_20260819_204500
  status: 'queued' | 'running' | 'completed' | 'failed' | 'stopped';
  started_date: string;
  completed_date: string | null;
  records_extracted: number;
  pages_visited: number;
  error_count: number;
  progress?: number;
};

export type CrawlRequest = {
  source_ids: number[];
  maximum_pages?: number;
  date_from?: string;
  keywords?: string[];
};

// Backend rotası: GET /api/crawlers/
export async function getCrawlHistory(): Promise<CrawlJob[]> {
  return await apiRequest<CrawlJob[]>('/api/crawlers/');
}

// Backend rotası: POST /api/crawlers/
export async function startCrawl(payload: CrawlRequest): Promise<{ job_id: string; status: string }> {
  return await apiRequest<{ job_id: string; status: string }>('/api/crawlers/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Çalışan bir tarama görevini durdurur
export async function stopCrawlJob(jobId: string): Promise<{ message: string; status: string }> {
  return await apiRequest<{ message: string; status: string }>(`/api/crawlers/${jobId}/stop`, {
    method: 'POST',
  });
}
