import requests
from bs4 import BeautifulSoup
import re  
import time
import random

def scrape_basic_info(url: str):
    try:
        # 2.5 saniye ile 5.7 saniye arasında rastgele bir küsuratlı sayı seç
        bekleme_suresi = random.uniform(2.5, 5.7)
        print(f"Görünmezlik kalkanı aktif: İstek atılmadan önce {bekleme_suresi:.2f} saniye insan taklidi yapılıyor...")

        # Botu bu rastgele süre kadar uyut (beklet)
        time.sleep(bekleme_suresi)  

        
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")
            
            page_title = soup.title.string if soup.title else "Başlık bulunamadı"
            meta_desc = soup.find("meta", attrs={"name": "description"})
            description = meta_desc["content"] if meta_desc else "Açıklama bulunamadı"
            
            raw_links = [a_tag["href"] for a_tag in soup.find_all("a", href=True)]
            unique_links = list(set(raw_links))[:50]


            # YENİ: OSINT VERİ MADENCİLİĞİ (REGEX İLE)
            # 1. Sitedeki tüm görünür metni boşluklarla birleştirerek alıyoruz
            page_text = soup.get_text(separator=' ')
            
            # 2. E-posta yakalama algoritması (Örn: isim@sirket.com)
            email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
            found_emails = list(set(re.findall(email_pattern, page_text)))
            
            # 3. Telefon numarası yakalama algoritması (Uluslararası ve yerel formatlar)
            phone_pattern = r'\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{2}[-.\s]?\d{2}'
            found_phones = list(set(re.findall(phone_pattern, page_text)))
            
            return {
                "url": url,
                "title": page_title,
                "description": description,
                "links": unique_links,
                "emails": found_emails,  # JSON'a ekledik
                "phones": found_phones,  # JSON'a ekledik
                "status": "success"
            }
            
        return {"url": url, "status": "error", "message": f"HTTP Hata Kodu: {response.status_code}"}
        
    except Exception as e:
        return {"url": url, "status": "error", "message": str(e)}