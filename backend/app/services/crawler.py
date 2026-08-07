import requests
from bs4 import BeautifulSoup
import re  
import time
import random
from urllib.parse import urljoin, urlparse

# Rastgele seçilecek gerçek tarayıcı kimlikleri (Maskeler)
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
        return {"url": url, "status": "skipped"}

    visited.add(url)

    bosluk = "  " * current_depth
    print(f"{bosluk}🕸️ [Derinlik {current_depth}/{max_depth}] Taranıyor: {url}")

    try:
        # 2.5 saniye ile 5.7 saniye arasında rastgele bir küsuratlı sayı seç
        bekleme_suresi = random.uniform(2.5, 5.7)
        print(f"Görünmezlik kalkanı aktif: İstek atılmadan önce {bekleme_suresi:.2f} saniye insan taklidi yapılıyor...")

        # Botu bu rastgele süre kadar uyut (beklet)
        time.sleep(bekleme_suresi)  

        # Rastgele bir tarayıcı kimliği (maske) seç
        secilen_maske = random.choice(USER_AGENTS)
        headers = {"User-Agent": secilen_maske}
        
        print(f"Maske takıldı: {secilen_maske[:40]}...") # Ekranda görmek için kısa halini yazdırıyoruz

        # Headers parametresi ile maskemizi karşı sunucuya gönderiyoruz
        response = requests.get(url, headers=headers, timeout=5)

        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")
            
            # .string yerine .text.strip() kullanarak içindeki tüm gereksiz boşlukları ve gizli karakterleri temizliyoruz.
            page_title = soup.title.text.strip() if soup.title and soup.title.text.strip() else "Başlık bulunamadı"
            meta_desc = soup.find("meta", attrs={"name": "description"})
            description = meta_desc["content"] if meta_desc else "Açıklama bulunamadı"
            
            # Sitenin kendi hatalarını düzeltmek için her linkin başındaki ve sonundaki boşlukları .strip() ile kesiyoruz.
            raw_links = [a_tag["href"].strip() for a_tag in soup.find_all("a", href=True)]
            unique_links = list(set(raw_links))[:50]


            # 1. OSINT VERİ MADENCİLİĞİ (REGEX İLE)
            # 1.1 Sitedeki tüm görünür metni boşluklarla birleştirerek alıyoruz
            page_text = soup.get_text(separator=' ')
            
            # 1.2 E-posta yakalama algoritması (Örn: isim@sirket.com)
            email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
            found_emails = list(set(re.findall(email_pattern, page_text)))
            
            # 1.3 Telefon numarası yakalama algoritması (Uluslararası ve yerel formatlar)
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
            
            # Ana sayfanın verisini bir listeye koyuyoruz. 
            all_scraped_data = [current_page_data]

            # 2. DERİN TARAMA (RECURSION) 
            if current_depth < max_depth:
                ana_domain = urlparse(url).netloc
                
                for link in unique_links:
                    tam_adres = urljoin(url, link)
                    hedef_domain = urlparse(tam_adres).netloc
                    
                    if hedef_domain == ana_domain and tam_adres not in visited:
                        # Fonksiyon kendi kendini çağırıyor ve alt sayfadan dönen veriyi alıyor
                        alt_sayfa_verisi = scrape_basic_info(tam_adres, current_depth + 1, max_depth, visited)
                        
                        # Eğer alt sayfadan veri geldiyse, ana listemize ekliyoruz
                        if isinstance(alt_sayfa_verisi, list):
                            all_scraped_data.extend(alt_sayfa_verisi)
                        elif isinstance(alt_sayfa_verisi, dict):
                            all_scraped_data.append(alt_sayfa_verisi)

            # 3. EN SON ÇIKIŞ (Return): Tüm verileri liste olarak dışarı aktarıyoruz
            return all_scraped_data
            
        return {"url": url, "status": "error", "message": f"HTTP Hata Kodu: {response.status_code}"}
        
    except Exception as e:
        return {"url": url, "status": "error", "message": str(e)}