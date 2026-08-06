from fastapi import FastAPI
from app.api.routes import health
from app.database.connection import engine, Base
from app.models import source, crawled_data  # SQLAlchemy'nin tabloyu tanıması için modeli import ediyoruz
# Mevcut satırı bul ve şu şekilde güncelle veya yeni satır olarak ekle:
from app.models.source import Source
from app.models.crawled_data import CrawledData
from app.api.routes import health, sources
from contextlib import asynccontextmanager
from app.scheduler import start_scheduler, scheduler  

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
