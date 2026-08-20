import { apiRequest } from './client';

export type SystemLog = {
  id: number;
  crawl_job_id: string;
  log_level: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  source: string;
  timestamp: string;
};

// Seviyeye göre logları çekme fonksiyonumuz (Backend'deki query parametresi ile uyumlu)
export async function getSystemLogs(level?: string): Promise<SystemLog[]> {
  const query = level ? `?level=${level}` : '';
  return await apiRequest<SystemLog[]>(`/api/logs/${query}`);
}