from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
import os

# Yeni veritabanı bağlantı ve tabloları başlatma fonksiyonumuzu alıyoruz
from app.database.connection import init_db

# Zamanlayıcıyı (scheduler) içeri aktarıyoruz
from app.scheduler import start_scheduler, scheduler  

from app.api.routes import health, sources , crawled_data, statistics , logs , crawls



# Uygulama açılırken ve kapanırken ne olacağını belirleyen sistem
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Sunucu başlarken zamanlayıcıyı çalıştır
    start_scheduler()
    yield
    # Sunucu kapanırken zamanlayıcıyı güvenli bir şekilde durdur
    scheduler.shutdown()

# lifespan'i FastAPI uygulamamıza tanımlıyoruz
app = FastAPI(
    title=os.getenv("APP_NAME", "OSINT Security Advisory Crawler API"),
    description="Siber Güvenlik Zafiyet ve Duyuru Tarayıcısı",
    lifespan=lifespan
)

# CORS (Cross-Origin Resource Sharing) Ayarları 
# React veya Vue gibi frontend uygulamalarının bu API'ye erişmesine izin veriyoruz
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,       # Sadece izin verilen adresler (Örn: localhost:3000)
    allow_credentials=True,
    allow_methods=["*"],         
    allow_headers=["*"],         
)

# Veritabanı tablolarını fiziksel olarak oluşturur ve gerekli başlangıç verilerini ekler
init_db()

# Çalışan rotalarımızı (endpoints) dahil ediyoruz
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(sources.router, prefix="/api/sources", tags=["Sources"])
app.include_router(crawled_data.router, prefix="/api/advisories", tags=["Advisories"])
app.include_router(statistics.router, prefix="/api/statistics", tags=["Dashboard Statistics"])
app.include_router(crawls.router, prefix="/api/crawlers", tags=["Crawl Jobs"])
app.include_router(logs.router, prefix="/api/logs", tags=["System Logs"])