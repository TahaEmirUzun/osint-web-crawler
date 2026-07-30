import requests
from bs4 import BeautifulSoup

# 1. Hedef URL'den temel bilgileri çeken ilk Crawler fonksiyonumuz
def scrape_basic_info(url: str):
    
    try:
        # 1.1. Hedef siteye istek atıyoruz (Timeout eklemek programın takılmasını önler)
        response = requests.get(url, timeout=5)
        
        # 1.2. Sitenin cevabı başarılı mı kontrol ediyoruz (Örn: HTTP 200)
        if response.status_code == 200:
            
            # 1.3. Gelen HTML metnini BeautifulSoup ile ayrıştırıyoruz (parse)
            soup = BeautifulSoup(response.text, "html.parser")
            
            # 1.4. Sayfanın başlık (<title>) etiketini buluyoruz
            page_title = soup.title.string if soup.title else "Başlık bulunamadı"
            
            # 1.5. Başarılı sonucu bir sözlük (dictionary) olarak döndürüyoruz
            return {
                "url": url,
                "title": page_title,
                "status": "success"
            }
        
        # 1.6. Siteye ulaşıldı ama hata kodu döndüyse (Örn: 404, 500)
        return {
            "url": url,
            "status": "error",
            "message": f"HTTP Hata Kodu: {response.status_code}"
        }
        
    except Exception as e:
        # 1.7. İnternet kesikse veya site hiç yoksa uygulamanın çökmesini (crash) engelliyoruz
        return {
            "url": url,
            "status": "error",
            "message": str(e)
        }