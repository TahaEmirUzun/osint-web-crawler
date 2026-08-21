import { apiRequest } from './client';

export type Advisory = {
  id: number;
  title: string;
  organization: string;
  publication_date: string;
  url: string;
  source_domain?: string;
  cve?: string;
  product?: string;
  severity: string;
  summary: string;
  collection_date?: string;
  crawl_job_id?: string;
};

export async function getAdvisories(): Promise<Advisory[]> {
  return await apiRequest<Advisory[]>('/api/advisories?limit=1000');
}