import requests
from bs4 import BeautifulSoup
import re  
import time
import random
import logging
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser
from app.services.security import is_safe_url

logger = logging.getLogger(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0"
]

def check_robots_txt(url: str, user_agent: str) -> bool:
    try:
        parsed_url = urlparse(url)
        robots_url = f"{parsed_url.scheme}://{parsed_url.netloc}/robots.txt"
        rp = RobotFileParser()
        rp.set_url(robots_url)
        rp.read()
        return rp.can_fetch(user_agent, url)
    except Exception:
        return True

def scrape_basic_info(url: str, current_depth: int = 1, max_depth: int = 2, visited: set = None, session: requests.Session = None):
    if visited is None:
        visited = set()
        
    # Her tarama için çerezleri (cookie) tutan kalıcı bir oturum başlatıyoruz (Anti-Bot bypass için)
    if session is None:
        session = requests.Session()
        
    if url in visited or current_depth > max_depth:
        return [] 

    visited.add(url)
    logger.info(f"[Derinlik {current_depth}/{max_depth}] Taranıyor: {url}")

    try:
        time.sleep(random.uniform(1.5, 3.0))

        # Gerçek bir tarayıcı gibi davranmak için gelişmiş başlıklar (Headers)
        headers = {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Upgrade-Insecure-Requests": "1",
            "Connection": "keep-alive"
        }

        if not is_safe_url(url):
            logger.warning(f"URL güvenli değil, iptal edildi: ({url})")
            return []

        if not check_robots_txt(url, headers["User-Agent"]):
            logger.warning(f"robots.txt bu sayfayı taramamızı yasaklıyor: {url}")
            return []

        max_retries = 2
        response = None
        for attempt in range(max_retries):
            try:
                response = session.get(url, headers=headers, timeout=15, allow_redirects=True)
                if response.status_code == 200:
                    break
                else:
                    logger.warning(f"HTTP {response.status_code} alındı: {url}")
            except requests.exceptions.RequestException as e:
                logger.warning(f"Bağlantı hatası (Deneme {attempt+1}/{max_retries}): {e}")
                time.sleep(2)

        if response and response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")
            
            # Başlık bulma algoritması güçlendirildi (Title yoksa H1 etiketine bak)
            page_title = "Başlık bulunamadı"
            if soup.title and soup.title.text.strip():
                page_title = soup.title.text.strip()
            elif soup.h1 and soup.h1.text.strip():
                page_title = soup.h1.text.strip()
            
            meta_desc = soup.find("meta", attrs={"name": "description"})
            description = meta_desc["content"] if meta_desc else ""
            
            page_text = soup.get_text(separator=' ')
            
            cve_pattern = r'(?i)CVE-\d{4}-\d{4,7}'
            found_cves = list(set(re.findall(cve_pattern, page_text)))
            cve_str = ", ".join(found_cves).upper() if found_cves else None

            severity_pattern = r'\b(Critical|High|Medium|Low)\b'
            severity_match = re.search(severity_pattern, page_text, re.IGNORECASE)
            severity_str = severity_match.group(1).capitalize() if severity_match else "Unknown"
            
            domain_name = urlparse(url).netloc.replace('www.', '')
            product_str = domain_name.capitalize()

            logger.info(f"Veri Çekildi! (CVE: {len(found_cves)}, Seviye: {severity_str})")

            current_page_data = {
                "url": url,
                "title": page_title,
                "description": description,
                "cve": cve_str,
                "severity": severity_str,
                "product": product_str,
                "status": "success"
            }
            
            all_scraped_data = [current_page_data]

            # ALT SAYFALARI AKILLI TARAMA (OSINT PRIORITIZATION)
            if current_depth < max_depth:
                ana_domain = urlparse(url).netloc
                raw_links = []
                
                for a_tag in soup.find_all("a", href=True):
                    href = a_tag["href"].strip()
                    # Gereksiz linkleri (mail, JS fonksiyonları) baştan ele
                    if href.startswith(("mailto:", "javascript:", "tel:", "#")):
                        continue
                        
                    tam_adres = urljoin(url, href)
                    hedef_domain = urlparse(tam_adres).netloc
                    
                    if hedef_domain == ana_domain and tam_adres not in visited:
                        raw_links.append(tam_adres)

                unique_links = list(set(raw_links))
                
                # ZEKİ BOT: Sadece siber güvenlik kelimelerini içeren en önemli 10 linki seçip onlara öncelik ver
                security_keywords = ["cve", "vuln", "security", "advisory", "bulletin", "patch", "update"]
                
                def score_link(link):
                    return sum(1 for kw in security_keywords if kw in link.lower())
                
                unique_links.sort(key=score_link, reverse=True)
                top_links = unique_links[:10] # 50 link çok fazlaydı, 10 kritik link derin tarama için ideal
                
                for link in top_links:
                    alt_sayfa_verisi = scrape_basic_info(link, current_depth + 1, max_depth, visited, session)
                    if isinstance(alt_sayfa_verisi, list):
                        all_scraped_data.extend(alt_sayfa_verisi)

            return all_scraped_data
            
        return []
        
    except Exception as e:
        logger.error(f"Kritik Hata: {str(e)}")
        return []