from fastapi import FastAPI, Request
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import time
import logging 
from logging.handlers import RotatingFileHandler # Log boyutu kontrolü için

from app.core import config
from app.core.errors import error_body, register_exception_handlers
from app.database.connection import init_db
from app.scheduler import start_scheduler, stop_scheduler
from app.services.crawl_runner import recover_interrupted_jobs
from app.services.source_seeder import seed_sources
from app.api.routes import health, sources, advisories, statistics, logs, crawls

# Docker'dan gelen LOG_DIR değişkenini okur, bulamazsa lokal yolu kullanır
LOG_DIR = os.getenv("LOG_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), "../logs"))

if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR, exist_ok=True)

# 1. Log Rotasyonu (Dosya şişmesini engeller)
# maxBytes=5*1024*1024 (5 MB limit), backupCount=2 (Sadece son 2 yedeği tutar)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler(os.path.join(LOG_DIR, "system.log"), maxBytes=5*1024*1024, backupCount=2, encoding='utf-8'),
        logging.StreamHandler()
    ]
)

# 2. Üçüncü Parti Kütüphaneleri Susturma (Gereksiz INFO loglarını gizler)
logging.getLogger("apscheduler").setLevel(logging.WARNING)

logger = logging.getLogger("OSINT-Crawler")
request_logger = logging.getLogger("OSINT-Crawler.requests")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Sistem başlatılıyor...")
    recovered = recover_interrupted_jobs()
    if recovered:
        logger.warning("%s yarıda kalmış tarama görevi kapatıldı.", recovered)
    seed_sources()
    start_scheduler()
    yield
    logger.info("Sistem kapatılıyor...")
    stop_scheduler()

app = FastAPI(
    title=config.APP_NAME,
    description="Siber Güvenlik Zafiyet ve Duyuru Tarayıcısı",
    version="1.1.0",
    lifespan=lifespan
)

register_exception_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    expose_headers=["X-Total-Count"],
)


@app.middleware("http")
async def limit_body_and_log_requests(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and content_length.isdigit() and int(content_length) > config.MAX_REQUEST_BODY_BYTES:
        request_logger.warning("İstek boyutu sınırı aşıldı: %s %s (%s byte)", request.method, request.url.path, content_length)
        return JSONResponse(status_code=413, content=error_body("PAYLOAD_TOO_LARGE", "İstek gövdesi izin verilen boyutu aşıyor."))

    started = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - started) * 1000
    log = request_logger.warning if response.status_code >= 400 else request_logger.info
    log("%s %s -> %s (%.1f ms)", request.method, request.url.path, response.status_code, duration_ms)
    return response


init_db()

app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(sources.router, prefix="/api/sources", tags=["Sources"])
app.include_router(advisories.router, prefix="/api/advisories", tags=["Advisories"])
app.include_router(statistics.router, prefix="/api/statistics", tags=["Dashboard Statistics"])
app.include_router(crawls.router, prefix="/api/crawls", tags=["Crawl Jobs"])
# Eski istemciler için geriye dönük uyumluluk (dokümantasyonda gösterilmez)
app.include_router(crawls.router, prefix="/api/crawlers", include_in_schema=False)
app.include_router(logs.router, prefix="/api/logs", tags=["System Logs"])
