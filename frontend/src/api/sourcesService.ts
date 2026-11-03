import { apiFetch, apiRequest } from './client';

export type Source = {
  id: number;
  name: string;
  base_url: string;
  enabled: boolean;
  request_delay_seconds: number;
  maximum_pages?: number;
  created_date?: string;
  updated_date?: string;
  last_crawl_date?: string | null;
  last_crawl_status?: string | null;
  last_crawl_records?: number | null;
};

export type SourceCreate = Pick<Source, 'name' | 'base_url' | 'enabled' | 'request_delay_seconds' | 'maximum_pages'>;

export type RobotsCheck = {
  source_id: number;
  url: string;
  robots_url: string;
  allowed: boolean;
  reason?: string | null;
};

export async function getSources(): Promise<Source[]> {
  return apiRequest<Source[]>('/api/sources');
}

export async function addSource(source: SourceCreate): Promise<Source> {
  return apiRequest<Source>('/api/sources', {
    method: 'POST',
    body: JSON.stringify(source),
  });
}

export async function updateSource(id: number, source: SourceCreate): Promise<Source> {
  return apiRequest<Source>(`/api/sources/${id}`, {
    method: 'PUT',
    body: JSON.stringify(source),
  });
}

export async function updateSourceStatus(id: number, enabled: boolean): Promise<Source> {
  return apiRequest<Source>(`/api/sources/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}

export async function checkSourceRobots(id: number): Promise<RobotsCheck> {
  return apiRequest<RobotsCheck>(`/api/sources/${id}/robots`);
}

// Backend'deki CSV export ucuna istek atıp dosyayı tarayıcıya indirir
export async function downloadSourceCsv(sourceId: number, sourceName: string): Promise<void> {
  const response = await apiFetch(`/api/sources/${sourceId}/export`);
  const blob = await response.blob();

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = sourceName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  a.download = `osint_${safeName}_zafiyetler.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
