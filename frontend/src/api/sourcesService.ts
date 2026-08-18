import { apiRequest } from './client';

// interface yerine type kullanıyoruz
export type Source = {
  id: number;
  name: string;
  base_url: string;
  enabled: boolean;
  request_delay_seconds: number;
};

// Kaynakları listeleme isteği
export async function getSources(): Promise<Source[]> {
  return apiRequest<Source[]>('/api/sources/');
}