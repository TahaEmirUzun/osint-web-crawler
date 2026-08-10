from wsgiref import headers
import requests
from bs4 import BeautifulSoup
import re  
import time
import random
from urllib.parse import urljoin, urlparse
from app.services.security import is_safe_url

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Edge/120.0.0.0"
]

def scrape_basic_info(url: str, current_depth: int = 1, max_depth: int = 2, visited: set = None):
    if visited is None:
        visited = set()
    
    if url in visited or current_depth > max_depth:
        return [] # Atlanan URL'ler için boş liste dönüyoruz

    visited.add(url)

    bosluk = "  " * current_depth
    print(f"{bosluk}🕸️ [Derinlik {current_depth}/{max_depth}] Taranıyor: {url}")

    try:
        bekleme_suresi = random.uniform(2.5, 5.7)
        print(f"Görünmezlik kalkanı aktif: İstek atılmadan önce {bekleme_suresi:.2f} saniye insan taklidi yapılıyor...")
        time.sleep(bekleme_suresi)  

        secilen_maske = random.choice(USER_AGENTS)
        headers = {"User-Agent": secilen_maske}
        print(f"Maske takıldı: {secilen_maske[:40]}...")

        # 1. SSRF KORUMASI
        if not is_safe_url(url):
            print(f"URL güvenli değil, tarama iptal edildi: ({url})")
            return [{
                "url": url, 
                "title": "🚨 SSRF ENGELİ", 
                "description": "İç ağa erişim yasaklandı.", 
                "emails": [], 
                "phones": [], 
                "links": []
            }] 

        response = requests.get(url, headers=headers, timeout=10)

        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")
            
            page_title = soup.title.text.strip() if soup.title and soup.title.text.strip() else "Başlık bulunamadı"
            meta_desc = soup.find("meta", attrs={"name": "description"})
            description = meta_desc["content"] if meta_desc else "Açıklama bulunamadı"
            
            raw_links = [a_tag["href"].strip() for a_tag in soup.find_all("a", href=True)]
            unique_links = list(set(raw_links))[:50]

            page_text = soup.get_text(separator=' ')
            
            email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
            found_emails = list(set(re.findall(email_pattern, page_text)))
            
            phone_pattern = r'\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{2}[-.\s]?\d{2}'
            found_phones = list(set(re.findall(phone_pattern, page_text)))

            print(f"{bosluk}✅ Veri Çekildi! (E-posta: {len(found_emails)}, Telefon: {len(found_phones)})")

            current_page_data = {
                "url": url,
                "title": page_title,
                "description": description,
                "links": unique_links,
                "emails": found_emails,  
                "phones": found_phones,  
                "status": "success"
            }
            
            all_scraped_data = [current_page_data]

            if current_depth < max_depth:
                ana_domain = urlparse(url).netloc
                
                for link in unique_links:
                    tam_adres = urljoin(url, link)
                    hedef_domain = urlparse(tam_adres).netloc
                    
                    if hedef_domain == ana_domain and tam_adres not in visited:
                        alt_sayfa_verisi = scrape_basic_info(tam_adres, current_depth + 1, max_depth, visited)
                        
                        if isinstance(alt_sayfa_verisi, list):
                            all_scraped_data.extend(alt_sayfa_verisi)

            return all_scraped_data
            
        # DÜZELTME BURADA: Eğer sayfa 200 dönmezse (Örn: 404 hatası) sözlük değil, LİSTE dönüyoruz
        return [{
            "url": url, 
            "title": f"HTTP Hata {response.status_code}", 
            "description": "Sayfa başarılı bir şekilde yüklenemedi.", 
            "emails": [], 
            "phones": [], 
            "links": []
        }]
        
    except Exception as e:
       return [{
                "url": url, 
                "title": "Hata", 
                "description": str(e), 
                "emails": [], 
                "phones": [], 
                "links": []
            }]