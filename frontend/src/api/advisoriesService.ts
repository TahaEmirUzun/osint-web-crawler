import { apiRequest } from './client';

export type Advisory = {
  id: number;
  title: string;
  organization: string;
  publication_date: string;
  url: string;
  source_domain: string;
  cve: string;
  product: string;
  severity: string;
  summary: string;
  collection_date: string;
};

export async function getAdvisories(): Promise<Advisory[]> {
  // Backend'den veri listesi veya sayfalama (pagination) formatında gelebilir, güvenli okuma yapıyoruz
  const data = await apiRequest<any>('/api/advisories');
  return data.items || data.advisories || data || [];
}