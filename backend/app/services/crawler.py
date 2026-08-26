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

# ÇOKLU AYRIŞTIRICI (MULTI-PARSER) FONKSİYONLARI

def parse_ubuntu(page_text: str, description: str, page_title: str, url: str) -> dict:
    """Ubuntu için özel ayrıştırıcı (USN Kodlarını da arar)"""
    usn_pattern = r'(?i)USN-\d{4}-\d{1,2}'
    found_usns = list(set(re.findall(usn_pattern, page_text)))
    
    cve_pattern = r'(?i)CVE-\d{4}-\d{4,7}'
    found_cves = list(set(re.findall(cve_pattern, page_text)))
    
    all_ids = found_cves + found_usns
    cve_str = ", ".join(all_ids).upper() if all_ids else None

    severity_pattern = r'\b(Critical|High|Medium|Low)\b'
    severity_match = re.search(severity_pattern, page_text, re.IGNORECASE)
    severity_str = severity_match.group(1).capitalize() if severity_match else "High"
    
    return {
        "url": url,
        "title": f"[Ubuntu] {page_title}",
        "description": description,
        "cve": cve_str,
        "severity": severity_str,
        "product": "Ubuntu Linux",
        "status": "success"
    }

def parse_postgresql(page_text: str, description: str, page_title: str, url: str) -> dict:
    """PostgreSQL için özel ayrıştırıcı"""
    cve_pattern = r'(?i)CVE-\d{4}-\d{4,7}'
    found_cves = list(set(re.findall(cve_pattern, page_text)))
    cve_str = ", ".join(found_cves).upper() if found_cves else None

    severity_pattern = r'\b(Critical|High|Medium|Low)\b'
    severity_match = re.search(severity_pattern, page_text, re.IGNORECASE)
    severity_str = severity_match.group(1).capitalize() if severity_match else "Medium"
    
    return {
        "url": url,
        "title": f"[PostgreSQL] {page_title}",
        "description": description,
        "cve": cve_str,
        "severity": severity_str,
        "product": "PostgreSQL Database",
        "status": "success"
    }

def parse_generic(page_text: str, description: str, page_title: str, url: str, domain_name: str) -> dict:
    """Orijinal (Senin yazdığın) genel Regex ayrıştırıcısı"""
    cve_pattern = r'(?i)CVE-\d{4}-\d{4,7}'
    found_cves = list(set(re.findall(cve_pattern, page_text)))
    cve_str = ", ".join(found_cves).upper() if found_cves else None

    severity_pattern = r'\b(Critical|High|Medium|Low)\b'
    severity_match = re.search(severity_pattern, page_text, re.IGNORECASE)
    severity_str = severity_match.group(1).capitalize() if severity_match else "Unknown"
    
    product_str = domain_name.capitalize()

    return {
        "url": url,
        "title": page_title,
        "description": description,
        "cve": cve_str,
        "severity": severity_str,
        "product": product_str,
        "status": "success"
    }


def scrape_basic_info(url: str, delay: int = 2, current_depth: int = 1, max_depth: int = 2, visited: set = None, session: requests.Session = None):
    if visited is None:
        visited = set()
        
    if session is None:
        session = requests.Session()
        
    if url in visited or current_depth > max_depth:
        return [] 

    # 1. GÜVENLİK VE ETİK KONTROLLERİ
    if not is_safe_url(url):
        msg = "SSRF Güvenlik Koruması: Hedef URL iç ağa ait veya güvenli değil."
        logger.warning(f"{msg} ({url})")
        if current_depth == 1: raise ValueError(msg)
        return []

    user_agent = random.choice(USER_AGENTS)
    if not check_robots_txt(url, user_agent):
        msg = "Etik Tarama: 'robots.txt' dosyası bu sayfanın taranmasını yasaklıyor."
        logger.warning(f"{msg} ({url})")
        if current_depth == 1: raise PermissionError(msg)
        return []

    visited.add(url)
    logger.info(f"[Derinlik {current_depth}/{max_depth}] Taranıyor: {url}")

    try:
        # DİNAMİK GECİKME (Veritabanından gelen delay + bot koruması için rastgele küsurat)
        time.sleep(delay + random.uniform(0.1, 0.5))

        headers = {
            "User-Agent": user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Upgrade-Insecure-Requests": "1",
            "Connection": "keep-alive"
        }

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

        # 2. BAĞLANTI HATASI KONTROLÜ
        if not response or response.status_code != 200:
            msg = f"Sunucuya ulaşılamadı (HTTP {response.status_code if response else 'Timeout'})"
            if current_depth == 1: raise ConnectionError(msg)
            return []

        soup = BeautifulSoup(response.text, "html.parser")
        
        page_title = "Başlık bulunamadı"
        if soup.title and soup.title.text.strip():
            page_title = soup.title.text.strip()
        elif soup.h1 and soup.h1.text.strip():
            page_title = soup.h1.text.strip()
        
        meta_desc = soup.find("meta", attrs={"name": "description"})
        description = meta_desc["content"] if meta_desc else ""
        page_text = soup.get_text(separator=' ')
        
        domain_name = urlparse(url).netloc.replace('www.', '')

        # ALAN ADINA GÖRE DOĞRU AYRIŞTIRICIYI (PARSER) SEÇ
        domain_lower = domain_name.lower()
        if "ubuntu.com" in domain_lower:
            current_page_data = parse_ubuntu(page_text, description, page_title, url)
        elif "postgresql.org" in domain_lower:
            current_page_data = parse_postgresql(page_text, description, page_title, url)
        else:
            current_page_data = parse_generic(page_text, description, page_title, url, domain_name)

        logger.info(f"Veri Çekildi! (CVE: {current_page_data['cve']}, Seviye: {current_page_data['severity']})")

        all_scraped_data = [current_page_data]

        if current_depth < max_depth:
            ana_domain = urlparse(url).netloc
            raw_links = []
            
            for a_tag in soup.find_all("a", href=True):
                href = a_tag["href"].strip()
                if href.startswith(("mailto:", "javascript:", "tel:", "#")):
                    continue
                    
                tam_adres = urljoin(url, href)
                hedef_domain = urlparse(tam_adres).netloc
                
                if hedef_domain == ana_domain and tam_adres not in visited:
                    raw_links.append(tam_adres)

            unique_links = list(set(raw_links))
            security_keywords = ["cve", "vuln", "security", "advisory", "bulletin", "patch", "update"]
            
            def score_link(link):
                return sum(1 for kw in security_keywords if kw in link.lower())
            
            unique_links.sort(key=score_link, reverse=True)
            top_links = unique_links[:10] 
            
            for link in top_links:
                # Delay değişkenini alt sayfalara (rekürsif) da aktar
                alt_sayfa_verisi = scrape_basic_info(link, delay, current_depth + 1, max_depth, visited, session)
                if isinstance(alt_sayfa_verisi, list):
                    all_scraped_data.extend(alt_sayfa_verisi)

        return all_scraped_data
        
    except Exception as e:
        if isinstance(e, (ValueError, PermissionError, ConnectionError)):
            raise e
        logger.error(f"Kritik Hata: {str(e)}")
        return []