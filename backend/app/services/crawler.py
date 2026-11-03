import logging
import re
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable, Optional
from urllib.parse import urldefrag, urljoin, urlparse
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup

from app.core import config
from app.services.security import get_url_rejection_reason

logger = logging.getLogger(__name__)

MAX_REDIRECTS = 5
MAX_RESPONSE_BYTES = 5 * 1024 * 1024
MAX_LINKS_PER_PAGE = 10
MAX_BLOCKED_RESPONSES = 3
BLOCKING_STATUS_CODES = {401, 403, 407, 429, 451}
RETRYABLE_STATUS_CODES = {408, 500, 502, 503, 504}

SECURITY_KEYWORDS = ["cve", "vuln", "security", "advisory", "advisories", "bulletin", "patch", "notice", "dsa-", "usn-"]
# Login, hesap ve ödeme gibi kısıtlı sayfalara hiç gidilmez
RESTRICTED_PATH_KEYWORDS = (
    "login", "log-in", "signin", "sign-in", "signup", "sign-up", "logout", "register",
    "account", "password", "auth", "oauth", "sso", "admin", "wp-admin", "cart", "checkout",
)

CVE_PATTERN = re.compile(r"(?i)\bCVE-\d{4}-\d{4,7}\b")
USN_PATTERN = re.compile(r"(?i)\bUSN-\d{4}-\d{1,2}\b")
SEVERITY_LABEL_PATTERN = re.compile(
    r"(?i)\b(?:severity|priority|impact|risk(?:\s+level)?|threat)\b\s*(?:rating|level)?\s*[:\-]?\s*"
    r"(critical|high|important|moderate|medium|low|negligible)\b"
)
SEVERITY_WORD_PATTERN = re.compile(r"(?i)\b(critical|high|medium|low)\b")
CVSS_SCORE_PATTERN = re.compile(r"(?i)\bcvss(?:\s*v?3(?:\.\d)?)?(?:\s+base)?\s*(?:score)?\s*[:\-]?\s*(\d{1,2}\.\d)\b")
SEVERITY_ALIASES = {
    "critical": "Critical",
    "high": "High",
    "important": "High",
    "moderate": "Medium",
    "medium": "Medium",
    "low": "Low",
    "negligible": "Low",
}

MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December"
DATE_TEXT_PATTERNS = [
    (re.compile(r"(?i)\b(?:published|released|issued|date|posted)\s*(?:on|date)?\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})"), ["%Y-%m-%d"]),
    (re.compile(rf"(?i)\b(?:published|released|issued|date|posted)\s*(?:on|date)?\s*[:\-]?\s*(\d{{1,2}}\s+(?:{MONTHS})\s+\d{{4}})"), ["%d %B %Y"]),
    (re.compile(rf"(?i)\b(?:published|released|issued|date|posted)\s*(?:on|date)?\s*[:\-]?\s*((?:{MONTHS})\s+\d{{1,2}},?\s+\d{{4}})"), ["%B %d, %Y", "%B %d %Y"]),
]
DATE_META_KEYS = (
    "article:published_time", "og:published_time", "datePublished", "date", "dc.date",
    "dc.date.issued", "dcterms.issued", "pubdate", "publish-date", "citation_publication_date",
)

ORGANIZATIONS = {
    "ubuntu.com": "Canonical (Ubuntu)",
    "postgresql.org": "PostgreSQL Global Development Group",
    "debian.org": "Debian Project",
    "archlinux.org": "Arch Linux",
    "curl.se": "curl Project",
    "ruby-lang.org": "Ruby Core Team",
    "apache.org": "Apache Software Foundation",
    "openssl.org": "OpenSSL Project",
    "nginx.org": "nginx (F5)",
    "wireshark.org": "Wireshark Foundation",
    "cisco.com": "Cisco",
}


class CrawlerError(Exception):
    """Bir kaynağın taranmasını engelleyen hata."""


class UnsafeUrlError(CrawlerError):
    pass


class RobotsDisallowedError(CrawlerError):
    pass


class AccessBlockedError(CrawlerError):
    pass


class FetchError(CrawlerError):
    pass


def _wait(seconds: float) -> None:
    if seconds > 0:
        time.sleep(seconds)


def create_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "User-Agent": config.CRAWLER_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        "Accept-Language": "en-US,en;q=0.5",
    })
    return session


def normalize_url(url: str) -> str:
    url, _ = urldefrag(url.strip())
    parsed = urlparse(url)
    netloc = parsed.netloc.lower()
    path = parsed.path or "/"
    normalized = f"{parsed.scheme.lower()}://{netloc}{path}"
    if parsed.query:
        normalized += f"?{parsed.query}"
    return normalized


def is_restricted_url(url: str) -> bool:
    parsed = urlparse(url)
    target = f"{parsed.path}?{parsed.query}".lower()
    return any(re.search(rf"(^|[/_\-.?=&]){re.escape(keyword)}($|[/_\-.?=&])", target) for keyword in RESTRICTED_PATH_KEYWORDS)


def looks_like_login_page(soup: BeautifulSoup) -> bool:
    return soup.find("input", attrs={"type": "password"}) is not None


def organization_for_domain(domain: str) -> str:
    domain = domain.lower().replace("www.", "")
    for known_domain, organization in ORGANIZATIONS.items():
        if domain == known_domain or domain.endswith("." + known_domain):
            return organization
    return domain


def clean_text(value: Optional[str], limit: Optional[int] = None) -> str:
    text = re.sub(r"\s+", " ", value or "").strip()
    if limit and len(text) > limit:
        text = text[: limit - 1].rstrip() + "…"
    return text


def extract_ids(pattern: re.Pattern, text: str) -> list:
    return sorted({match.upper() for match in pattern.findall(text)})


def extract_severity(page_text: str, default: str = "Unknown") -> str:
    label_match = SEVERITY_LABEL_PATTERN.search(page_text)
    if label_match:
        return SEVERITY_ALIASES[label_match.group(1).lower()]

    score_match = CVSS_SCORE_PATTERN.search(page_text)
    if score_match:
        score = float(score_match.group(1))
        if score >= 9.0:
            return "Critical"
        if score >= 7.0:
            return "High"
        if score >= 4.0:
            return "Medium"
        if score > 0:
            return "Low"

    word_match = SEVERITY_WORD_PATTERN.search(page_text)
    if word_match:
        return SEVERITY_ALIASES[word_match.group(1).lower()]
    return default


def _parse_date(value: str) -> Optional[datetime]:
    value = (value or "").strip()
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=None)
    except ValueError:
        pass
    for date_format in ("%Y-%m-%d", "%d %B %Y", "%B %d, %Y", "%B %d %Y", "%d %b %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(value[:30], date_format)
        except ValueError:
            continue
    return None


def extract_publication_date(soup: BeautifulSoup, page_text: str) -> Optional[datetime]:
    for key in DATE_META_KEYS:
        meta = soup.find("meta", attrs={"property": key}) or soup.find("meta", attrs={"name": key}) or soup.find("meta", attrs={"itemprop": key})
        if meta and meta.get("content"):
            parsed = _parse_date(meta["content"])
            if parsed:
                return parsed

    time_tag = soup.find("time", attrs={"datetime": True})
    if time_tag:
        parsed = _parse_date(time_tag["datetime"])
        if parsed:
            return parsed

    for pattern, formats in DATE_TEXT_PATTERNS:
        match = pattern.search(page_text)
        if not match:
            continue
        raw_value = re.sub(r"\s+", " ", match.group(1))
        for date_format in formats:
            try:
                return datetime.strptime(raw_value, date_format)
            except ValueError:
                continue
    return None


def extract_summary(soup: BeautifulSoup, description: str) -> str:
    if description:
        return clean_text(description, 1000)
    container = soup.find("main") or soup.find("article") or soup.body or soup
    for paragraph in container.find_all("p"):
        text = clean_text(paragraph.get_text(" "))
        if len(text) >= 40:
            return clean_text(text, 1000)
    return ""


# ÇOKLU AYRIŞTIRICI (MULTI-PARSER) FONKSİYONLARI

def parse_ubuntu(page_text: str, description: str, page_title: str, url: str) -> dict:
    """Ubuntu için özel ayrıştırıcı (USN Kodlarını da arar)"""
    found_cves = extract_ids(CVE_PATTERN, page_text)
    found_usns = extract_ids(USN_PATTERN, page_text)
    all_ids = found_cves or found_usns
    title = clean_text(page_title).removesuffix(" | Ubuntu").strip()

    return {
        "url": url,
        "title": f"[Ubuntu] {title}",
        "description": clean_text(description, 1000),
        "cve": ", ".join(all_ids) if all_ids else None,
        "severity": extract_severity(page_text),
        "product": "Ubuntu Linux",
        "organization": ORGANIZATIONS["ubuntu.com"],
        "status": "success"
    }

def parse_postgresql(page_text: str, description: str, page_title: str, url: str) -> dict:
    """PostgreSQL için özel ayrıştırıcı"""
    found_cves = extract_ids(CVE_PATTERN, page_text)
    title = clean_text(page_title).removeprefix("PostgreSQL:").strip()

    return {
        "url": url,
        "title": f"[PostgreSQL] {title}",
        "description": clean_text(description, 1000),
        "cve": ", ".join(found_cves) if found_cves else None,
        "severity": extract_severity(page_text),
        "product": "PostgreSQL Database",
        "organization": ORGANIZATIONS["postgresql.org"],
        "status": "success"
    }

def parse_generic(page_text: str, description: str, page_title: str, url: str, domain_name: str) -> dict:
    """Genel Regex ayrıştırıcısı"""
    found_cves = extract_ids(CVE_PATTERN, page_text)

    return {
        "url": url,
        "title": clean_text(page_title),
        "description": clean_text(description, 1000),
        "cve": ", ".join(found_cves) if found_cves else None,
        "severity": extract_severity(page_text),
        "product": domain_name.capitalize(),
        "organization": organization_for_domain(domain_name),
        "status": "success"
    }


def parse_page(html: str, url: str) -> Optional[dict]:
    """Alan adına göre doğru ayrıştırıcıyı seçer ve sayfadan yapılandırılmış kayıt üretir."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    page_title = "Başlık bulunamadı"
    if soup.title and soup.title.get_text(strip=True):
        page_title = soup.title.get_text(" ", strip=True)
    elif soup.h1 and soup.h1.get_text(strip=True):
        page_title = soup.h1.get_text(" ", strip=True)

    meta_desc = soup.find("meta", attrs={"name": "description"})
    description = extract_summary(soup, meta_desc.get("content", "") if meta_desc else "")
    page_text = soup.get_text(separator=" ")

    domain_name = urlparse(url).netloc.lower().replace("www.", "")
    if "ubuntu.com" in domain_name:
        record = parse_ubuntu(page_text, description, page_title, url)
    elif "postgresql.org" in domain_name:
        record = parse_postgresql(page_text, description, page_title, url)
    else:
        record = parse_generic(page_text, description, page_title, url, domain_name)

    record["publication_date"] = extract_publication_date(soup, page_text)
    return record


def is_advisory_record(record: dict) -> bool:
    """CVE/USN içermeyen ve güvenlikle ilgisi olmayan sayfaları (ana sayfa, hakkında vb.) eler."""
    if record.get("cve"):
        return True
    haystack = f"{record.get('url', '')} {record.get('title', '')}".lower()
    return any(keyword in haystack for keyword in SECURITY_KEYWORDS)


class RateLimiter:
    """Aynı domaine yapılan istekler arasında en az `delay` saniye bekler."""

    def __init__(self):
        self._last_request = {}

    def wait(self, domain: str, delay: float) -> None:
        last = self._last_request.get(domain)
        if last is not None:
            remaining = delay - (time.monotonic() - last)
            _wait(remaining)
        self._last_request[domain] = time.monotonic()


class RobotsCache:
    """robots.txt dosyalarını domain başına bir kez indirir ve kurallarını uygular (RFC 9309)."""

    def __init__(self, session: requests.Session, user_agent: str):
        self.session = session
        self.user_agent = user_agent
        self._parsers = {}

    def _get_parser(self, url: str) -> RobotFileParser:
        parsed = urlparse(url)
        base = f"{parsed.scheme}://{parsed.netloc}"
        if base in self._parsers:
            return self._parsers[base]

        parser = RobotFileParser()
        robots_url = f"{base}/robots.txt"
        try:
            response, _ = safe_get(self.session, robots_url)
            if response.status_code in (401, 403):
                parser.disallow_all = True
            elif 400 <= response.status_code < 500:
                parser.allow_all = True
            elif response.status_code >= 500:
                parser.disallow_all = True
            else:
                parser.parse(response.text.splitlines())
        except (requests.RequestException, CrawlerError) as exc:
            logger.warning("robots.txt okunamadı, ihtiyaten tarama yapılmayacak (%s): %s", robots_url, exc)
            parser.disallow_all = True

        self._parsers[base] = parser
        return parser

    def allowed(self, url: str) -> bool:
        return self._get_parser(url).can_fetch(self.user_agent, url)

    def crawl_delay(self, url: str) -> Optional[float]:
        delay = self._get_parser(url).crawl_delay(self.user_agent)
        return float(delay) if delay else None


def safe_get(session: requests.Session, url: str):
    """Yönlendirmeleri tek tek takip eder ve her adımda SSRF kontrolü yapar."""
    current_url = url
    for _ in range(MAX_REDIRECTS + 1):
        reason = get_url_rejection_reason(current_url)
        if reason:
            raise UnsafeUrlError(f"SSRF Güvenlik Koruması: {reason}")

        response = session.get(current_url, timeout=config.CRAWLER_TIMEOUT_SECONDS, allow_redirects=False)
        if response.is_redirect:
            location = response.headers.get("Location", "")
            current_url = urljoin(current_url, location)
            continue

        content_length = response.headers.get("Content-Length")
        if content_length and content_length.isdigit() and int(content_length) > MAX_RESPONSE_BYTES:
            raise FetchError(f"Yanıt boyutu sınırı aşıldı ({content_length} byte)")
        return response, current_url

    raise FetchError("Çok fazla yönlendirme")


@dataclass
class CrawlResult:
    records: list = field(default_factory=list)
    pages_visited: int = 0
    errors: int = 0
    error_messages: list = field(default_factory=list)
    stopped: bool = False
    blocked: bool = False


class CrawlerEngine:
    """Kullanıcı arayüzünden bağımsız çalışabilen, tekrar kullanılabilir tarayıcı motoru."""

    def __init__(
        self,
        delay: float = 2,
        max_pages: int = 100,
        max_depth: int = 2,
        session: Optional[requests.Session] = None,
        should_stop: Optional[Callable[[], bool]] = None,
        on_page: Optional[Callable[[CrawlResult], None]] = None,
    ):
        self.delay = max(float(delay or 0), float(config.CRAWLER_MIN_DELAY_SECONDS))
        self.max_pages = max(1, int(max_pages))
        self.max_depth = max(1, int(max_depth))
        self.session = session or create_session()
        self.user_agent = self.session.headers.get("User-Agent", config.CRAWLER_USER_AGENT)
        self.robots = RobotsCache(self.session, self.user_agent)
        self.rate_limiter = RateLimiter()
        self.should_stop = should_stop
        self.on_page = on_page

    def _fetch(self, url: str):
        domain = urlparse(url).netloc
        delay = max(self.delay, self.robots.crawl_delay(url) or 0)
        last_error = "Bilinmeyen hata"

        for attempt in range(1, config.CRAWLER_MAX_RETRIES + 1):
            self.rate_limiter.wait(domain, delay)
            try:
                response, final_url = safe_get(self.session, url)
            except (requests.Timeout, requests.ConnectionError) as exc:
                last_error = f"Bağlantı hatası: {exc.__class__.__name__}"
                logger.warning("%s (Deneme %s/%s): %s", last_error, attempt, config.CRAWLER_MAX_RETRIES, url)
                _wait(min(2 ** attempt, 30))
                continue
            except requests.RequestException as exc:
                raise FetchError(f"İstek hatası: {exc.__class__.__name__}") from exc

            if response.status_code == 200:
                return response, final_url
            if response.status_code in BLOCKING_STATUS_CODES:
                raise AccessBlockedError(f"Erişim engellendi (HTTP {response.status_code})")
            if response.status_code in RETRYABLE_STATUS_CODES:
                last_error = f"HTTP {response.status_code}"
                retry_after = response.headers.get("Retry-After", "")
                backoff = int(retry_after) if retry_after.isdigit() else 2 ** attempt
                logger.warning("Geçici hata %s (Deneme %s/%s): %s", last_error, attempt, config.CRAWLER_MAX_RETRIES, url)
                _wait(min(backoff, 60))
                continue
            raise FetchError(f"HTTP {response.status_code}")

        raise FetchError(f"Sunucuya ulaşılamadı ({last_error})")

    def _extract_links(self, html: str, page_url: str, seen: set) -> list:
        soup = BeautifulSoup(html, "html.parser")
        main_domain = urlparse(page_url).netloc.lower()
        links = set()
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"].strip()
            if href.startswith(("mailto:", "javascript:", "tel:", "#", "data:")):
                continue
            absolute = normalize_url(urljoin(page_url, href))
            parsed = urlparse(absolute)
            if parsed.scheme not in ("http", "https") or parsed.netloc != main_domain:
                continue
            if absolute in seen or is_restricted_url(absolute):
                continue
            links.add(absolute)

        def score(link: str) -> int:
            return sum(1 for keyword in SECURITY_KEYWORDS if keyword in link.lower())

        return sorted(links, key=lambda link: (-score(link), link))[:MAX_LINKS_PER_PAGE]

    def crawl(self, start_url: str) -> CrawlResult:
        result = CrawlResult()
        start_url = normalize_url(start_url)

        reason = get_url_rejection_reason(start_url)
        if reason:
            raise UnsafeUrlError(f"SSRF Güvenlik Koruması: {reason}")
        if not self.robots.allowed(start_url):
            raise RobotsDisallowedError("Etik Tarama: 'robots.txt' dosyası bu sayfanın taranmasını yasaklıyor.")

        queue = deque([(start_url, 1)])
        seen = {start_url}
        blocked_responses = 0

        while queue and result.pages_visited < self.max_pages:
            if self.should_stop and self.should_stop():
                result.stopped = True
                break

            url, depth = queue.popleft()
            is_start_page = url == start_url

            if not is_start_page and (is_restricted_url(url) or not self.robots.allowed(url)):
                logger.info("Atlandı (robots.txt veya kısıtlı sayfa): %s", url)
                continue

            try:
                response, final_url = self._fetch(url)
            except AccessBlockedError as exc:
                blocked_responses += 1
                result.errors += 1
                result.error_messages.append(f"{url}: {exc}")
                if is_start_page:
                    raise
                if blocked_responses >= MAX_BLOCKED_RESPONSES:
                    result.blocked = True
                    logger.warning("Tekrarlanan erişim engeli nedeniyle tarama durduruldu: %s", start_url)
                    break
                continue
            except CrawlerError as exc:
                if is_start_page:
                    raise
                result.errors += 1
                result.error_messages.append(f"{url}: {exc}")
                continue

            blocked_responses = 0
            result.pages_visited += 1
            final_url = normalize_url(final_url)
            seen.add(final_url)

            content_type = response.headers.get("Content-Type", "text/html").lower()
            if "html" not in content_type:
                continue

            html = response.text[:MAX_RESPONSE_BYTES]
            soup = BeautifulSoup(html, "html.parser")
            if looks_like_login_page(soup):
                logger.info("Login sayfası tespit edildi, içerik toplanmadı: %s", final_url)
                continue

            logger.info("[Derinlik %s/%s] Taranıyor: %s", depth, self.max_depth, final_url)
            record = parse_page(html, final_url)
            if record and is_advisory_record(record):
                result.records.append(record)

            if depth < self.max_depth:
                for link in self._extract_links(html, final_url, seen):
                    seen.add(link)
                    queue.append((link, depth + 1))

            if self.on_page:
                self.on_page(result)

        return result


def scrape_basic_info(url: str, delay: int = 2, max_depth: int = 2, max_pages: int = 100, **kwargs) -> list:
    """Eski kullanım için geriye dönük uyumlu yardımcı fonksiyon."""
    engine = CrawlerEngine(delay=delay, max_pages=max_pages, max_depth=max_depth, **kwargs)
    return engine.crawl(url).records
