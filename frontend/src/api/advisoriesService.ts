import { apiRequest } from './client';

export type Advisory = {
  id: number;
  title: string;
  organization?: string | null;
  publication_date?: string | null;
  url: string;
  source_domain?: string | null;
  cve?: string | null;
  product?: string | null;
  severity: string;
  summary: string;
  collection_date?: string | null;
  last_updated?: string | null;
  crawl_job_id?: string | null;
};

export async function getAdvisories(limit = 1000): Promise<Advisory[]> {
  return await apiRequest<Advisory[]>(`/api/advisories?limit=${limit}`);
}

export async function getRecentAdvisories(count = 5): Promise<Advisory[]> {
  return await apiRequest<Advisory[]>(`/api/advisories?page=1&page_size=${count}&sort_by=collection_date&sort_order=desc`);
}

export async function deleteAdvisory(id: number): Promise<void> {
  await apiRequest<void>(`/api/advisories/${id}`, { method: 'DELETE' });
}
