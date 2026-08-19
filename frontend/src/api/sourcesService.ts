import { apiRequest } from './client';

export type Source = {
  id: number;
  name: string;
  base_url: string;
  enabled: boolean;
  request_delay_seconds: number;
};

// Yeni kayıt eklerken ID'yi biz değil, veritabanı atayacağı için Omit kullanıyoruz
export type SourceCreate = Omit<Source, 'id'>;

export async function getSources(): Promise<Source[]> {
  return apiRequest<Source[]>('/api/sources/');
}

// POST isteği atacak yeni fonksiyonumuz
export async function addSource(source: SourceCreate): Promise<Source> {
  return apiRequest<Source>('/api/sources/', {
    method: 'POST',
    body: JSON.stringify(source),
  });
}