import os


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _float_env(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


APP_NAME = os.getenv("APP_NAME", "OSINT Security Advisory Crawler API")

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
    if origin.strip()
]

MAX_REQUEST_BODY_BYTES = _int_env("MAX_REQUEST_BODY_BYTES", 1024 * 1024)

CRAWLER_USER_AGENT = os.getenv(
    "CRAWLER_USER_AGENT",
    "OSINT-Advisory-Crawler/1.0 (+https://github.com/TahaEmirUzun/osint-web-crawler; public security advisory research)",
)
CRAWLER_TIMEOUT_SECONDS = _float_env("CRAWLER_TIMEOUT_SECONDS", 15.0)
CRAWLER_MAX_RETRIES = _int_env("CRAWLER_MAX_RETRIES", 3)
CRAWLER_MAX_PAGES_LIMIT = _int_env("CRAWLER_MAX_PAGES_LIMIT", 500)
CRAWLER_MAX_DEPTH_LIMIT = _int_env("CRAWLER_MAX_DEPTH_LIMIT", 3)
CRAWLER_MIN_DELAY_SECONDS = _int_env("CRAWLER_MIN_DELAY_SECONDS", 1)

AUTO_CRAWL_INTERVAL_HOURS = _int_env("AUTO_CRAWL_INTERVAL_HOURS", 12)
SEED_SOURCES_FILE = os.getenv(
    "SEED_SOURCES_FILE",
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "config", "sources.json"),
)
