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

// Backend'deki CSV export ucuna istek atıp dosyayı tarayıcıya indirir
export async function downloadSourceCsv(sourceId: number, sourceName: string) {
  try {
    // Vite sunucusuna (5173) değil, doğrudan FastAPI backend'ine (8000) gidiyoruz!
    const response = await fetch(`http://127.0.0.1:8000/api/sources/${sourceId}/export`);
    
    if (!response.ok) {
      throw new Error('Dosya indirilemedi. Backend çalışmıyor olabilir.');
    }

    // Gelen raw veriyi Blob (binary large object) formatına çeviriyoruz
    const blob = await response.blob();
    
    // Tarayıcı belleğinde geçici bir indirme linki (URL) oluşturuyoruz
    const url = window.URL.createObjectURL(blob);
    
    // Görünmez bir <a> etiketi oluşturup tıklama simülasyonu yapıyoruz
    const a = document.createElement('a');
    a.href = url;
    
    // Dosya adını dinamik olarak kaynağın ismine göre belirliyoruz
    const safeName = sourceName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.download = `osint_${safeName}_zafiyetler.csv`;
    
    document.body.appendChild(a);
    a.click();
    
    // İşlem bitince belleği temizliyoruz
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("CSV İndirme Hatası:", error);
    alert("CSV dosyası indirilirken bir hata oluştu. Backend bağlantınızı kontrol edin.");
  }
}