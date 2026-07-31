import requests
from bs4 import BeautifulSoup


# 1. Hedef URL'den detaylı bilgileri ve linkleri çeken Crawler
def scrape_basic_info(url: str):
    
    try:
        # 1.1. Hedef siteye istek atıyoruz
        response = requests.get(url, timeout=5)
        
        # 1.2. Sitenin cevabı başarılı mı kontrol ediyoruz
        if response.status_code == 200:
            
            # 1.3. Gelen HTML metnini BeautifulSoup ile ayrıştırıyoruz
            soup = BeautifulSoup(response.text, "html.parser")
            
            # 1.4. Sayfanın başlık (<title>) etiketini buluyoruz
            page_title = soup.title.string if soup.title else "Başlık bulunamadı"
            
            # 1.5. YENİ: Sayfanın meta açıklamasını (description) çekiyoruz
            meta_desc = soup.find("meta", attrs={"name": "description"})
            description = meta_desc["content"] if meta_desc else "Açıklama bulunamadı"
            
            # 1.6. YENİ: Sayfadaki tüm linkleri (<a> etiketlerinin href özelliklerini) topluyoruz
            raw_links = []
            for a_tag in soup.find_all("a", href=True):
                raw_links.append(a_tag["href"])
                
            # 1.7. YENİ: Aynı linkleri (tekrarları) temizliyoruz. 
            # Not: Test aşamasında Swagger UI kilitlenmesin diye şimdilik ilk 50 linki alıyoruz.
            unique_links = list(set(raw_links))[:50]
            
            # 1.8. Başarılı sonucu detaylı bir sözlük olarak döndürüyoruz
            return {
                "url": url,
                "title": page_title,
                "description": description,
                "total_links_found": len(set(raw_links)),
                "links": unique_links,
                "status": "success"
            }
        
        # 1.9. Siteye ulaşıldı ama hata kodu döndüyse
        return {
            "url": url,
            "status": "error",
            "message": f"HTTP Hata Kodu: {response.status_code}"
        }
        
    except Exception as e:
        # 1.10. İnternet kesikse veya site hiç yoksa uygulamanın çökmesini engelliyoruz
        return {
            "url": url,
            "status": "error",
            "message": str(e)
        }