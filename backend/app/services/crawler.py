import requests
from bs4 import BeautifulSoup
import re  
import time
import random
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser
from app.services.security import is_safe_url

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Edge/120.0.0.0"
]

def check_robots_txt(url: str, user_agent: str) -> bool:
    """Hedef sitenin robots.txt dosyasını okur ve taramaya izin verilip verilmediğini kontrol eder."""
    try:
        parsed_url = urlparse(url)
        robots_url = f"{parsed_url.scheme}://{parsed_url.netloc}/robots.txt"
        rp = RobotFileParser()
        rp.set_url(robots_url)
        rp.read()
        return rp.can_fetch(user_agent, url)
    except Exception:
        # robots.txt okunamıyorsa (yoksa veya hatalıysa) varsayılan olarak izin ver
        return True

def scrape_basic_info(url: str, current_depth: int = 1, max_depth: int = 2, visited: set = None):
    if visited is None:
        visited = set()
    
    if url in visited or current_depth > max_depth:
        return [] 

    visited.add(url)
    bosluk = "  " * current_depth
    print(f"{bosluk}🕸️ [Derinlik {current_depth}/{max_depth}] Taranıyor: {url}")

    try:
        bekleme_suresi = random.uniform(2.5, 5.7)
        print(f"{bosluk}Görünmezlik aktif: {bekleme_suresi:.2f} sn bekleniyor...")
        time.sleep(bekleme_suresi)  

        secilen_maske = random.choice(USER_AGENTS)
        headers = {"User-Agent": secilen_maske}

        # 1. SSRF KORUMASI
        if not is_safe_url(url):
            print(f"{bosluk}🚨 URL güvenli değil, iptal edildi: ({url})")
            return []

        # 2. ROBOTS.TXT KONTROLÜ
        if not check_robots_txt(url, secilen_maske):
            print(f"{bosluk}✋ robots.txt bu sayfayı taramamızı yasaklıyor: {url}")
            return []

        # 3. YENİDEN DENEME (RETRY) MEKANİZMASI (Geçici kopmalara karşı)
        max_retries = 3
        response = None
        for attempt in range(max_retries):
            try:
                response = requests.get(url, headers=headers, timeout=10)
                if response.status_code == 200:
                    break
            except requests.exceptions.RequestException as e:
                print(f"{bosluk}⚠️ Bağlantı hatası (Deneme {attempt+1}/{max_retries}): {e}")
                time.sleep(2)

        if response and response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")
            
            page_title = soup.title.text.strip() if soup.title and soup.title.text.strip() else "Başlık bulunamadı"
            meta_desc = soup.find("meta", attrs={"name": "description"})
            description = meta_desc["content"] if meta_desc else ""
            
            raw_links = [a_tag["href"].strip() for a_tag in soup.find_all("a", href=True)]
            unique_links = list(set(raw_links))[:50]

            page_text = soup.get_text(separator=' ')
            
            # --- YENİ: SİBER GÜVENLİK ZAFİYET VERİSİ (CVE, Severity) ÇIKARMA ---
            cve_pattern = r'(?i)CVE-\d{4}-\d{4,7}'
            found_cves = list(set(re.findall(cve_pattern, page_text)))
            cve_str = ", ".join(found_cves).upper() if found_cves else None

            severity_pattern = r'\b(Critical|High|Medium|Low)\b'
            severity_match = re.search(severity_pattern, page_text, re.IGNORECASE)
            severity_str = severity_match.group(1).capitalize() if severity_match else "Unknown"
            
            # Product için basit bir başlık veya açıklama analizi (geliştirilebilir)
            product_str = page_title.split()[0] if page_title else "Unknown"
            # --------------------------------------------------------------------

            print(f"{bosluk}✅ Veri Çekildi! (CVE: {len(found_cves)}, Seviye: {severity_str})")

            current_page_data = {
                "url": url,
                "title": page_title,
                "description": description,
                "links": unique_links,
                "cve": cve_str,
                "severity": severity_str,
                "product": product_str,
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
            
        return []
        
    except Exception as e:
        print(f"{bosluk}❌ Kritik Hata: {str(e)}")
        return []