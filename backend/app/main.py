from fastapi import FastAPI
from app.api.routes import health
from app.database.connection import engine, Base
from app.models import source, crawled_data  # SQLAlchemy'nin tabloyu tanıması için modeli import ediyoruz
from app.models.source import Source
from app.models.crawled_data import CrawledData
from app.api.routes import health, sources
from contextlib import asynccontextmanager
from app.scheduler import start_scheduler, scheduler  
from app.api.routes import sources, crawled_data 
from app.api.routes import sources, crawled_data, statistics

# Uygulama açılırken ve kapanırken ne olacağını belirleyen sistem
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Sunucu başlarken zamanlayıcıyı çalıştır
    start_scheduler()
    yield
    # Sunucu kapanırken zamanlayıcıyı güvenli bir şekilde durdur
    scheduler.shutdown()

# lifespan'i FastAPI uygulamamıza tanımlıyoruz
app = FastAPI(title="OSINT Web Crawler API", lifespan=lifespan)

# Veritabanı tablolarını fiziksel olarak oluşturur
Base.metadata.create_all(bind=engine)

# health dosyasının içindeki router değişkenini buraya çağırıyoruz
app.include_router(health.router, prefix="/api", tags=["Health"])

app.include_router(sources.router, prefix="/api/sources", tags=["Sources"])

app.include_router(crawled_data.router, prefix="/api/crawled-data", tags=["Crawled Data / Advisories"])

app.include_router(statistics.router, prefix="/api/statistics", tags=["Dashboard Statistics"])

