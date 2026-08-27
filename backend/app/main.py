from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
import os
import logging 
from logging.handlers import RotatingFileHandler # Log boyutu kontrolü için

from app.database.connection import init_db
from app.scheduler import start_scheduler, scheduler  
from app.api.routes import health, sources , crawled_data, statistics , logs , crawls

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Sistem başlatılıyor...")
    start_scheduler()
    yield
    logger.info("Sistem kapatılıyor...")
    scheduler.shutdown()

app = FastAPI(
    title=os.getenv("APP_NAME", "OSINT Security Advisory Crawler API"),
    description="Siber Güvenlik Zafiyet ve Duyuru Tarayıcısı",
    lifespan=lifespan
)

origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],             
    allow_headers=["*"],         
)

init_db()

app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(sources.router, prefix="/api/sources", tags=["Sources"])
app.include_router(crawled_data.router, prefix="/api/advisories", tags=["Advisories"])
app.include_router(statistics.router, prefix="/api/statistics", tags=["Dashboard Statistics"])
app.include_router(crawls.router, prefix="/api/crawlers", tags=["Crawl Jobs"])
app.include_router(logs.router, prefix="/api/logs", tags=["System Logs"])