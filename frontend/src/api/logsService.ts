import { apiRequest, buildQuery } from './client';

export type SystemLog = {
  id: number;
  crawl_job_id: string | null;
  log_level: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  source: string | null;
  timestamp: string;
};

export type LogFilters = {
  level?: string;
  job_id?: string;
  source?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
};

// Backend'deki query parametreleri ile uyumlu filtreleme
export async function getSystemLogs(filters: LogFilters | string = {}): Promise<SystemLog[]> {
  const params = typeof filters === 'string' ? { level: filters } : filters;
  return await apiRequest<SystemLog[]>(`/api/logs${buildQuery(params)}`);
}
