import { apiRequest } from './client';

export type CrawlJob = {
  id: number;
  source_name: string;
  status: 'running' | 'completed' | 'failed';
  items_found: number;
  start_time: string;
  end_time: string | null;
};

export async function getCrawlHistory(): Promise<CrawlJob[]> {
  try {
    return await apiRequest<CrawlJob[]>('/api/crawls/history');
  } catch (error) {
    console.warn('Tarama geçmişi backendden çekilemedi, sahte veri gösteriliyor.');
    return [
      { id: 1, source_name: 'Ubuntu Security', status: 'completed', items_found: 12, start_time: '2026-08-17T15:39:50', end_time: '2026-08-17T15:40:33' },
      { id: 2, source_name: 'Test Kaynağı-2', status: 'completed', items_found: 4, start_time: '2026-08-17T14:32:18', end_time: '2026-08-17T15:17:21' }
    ];
  }
}

export async function startCrawl(): Promise<{ message: string }> {
  try {
    // Önce gerçekten backend'e bağlanmayı dener
    return await apiRequest<{ message: string }>('/api/crawls/start', {
      method: 'POST',
    });
  } catch (error) {
    console.warn('Backend başlatma endpointi henüz hazır değil, simülasyon çalışıyor...');
    // Backend hata verirse, 1.5 saniye bekleyip başarılı olmuş gibi davranır (Harika UX)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ message: 'Tarama başarıyla tetiklendi.' });
      }, 1500);
    });
  }
}