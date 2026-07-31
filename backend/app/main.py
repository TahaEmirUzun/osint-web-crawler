from fastapi import FastAPI
from app.api.routes import health
from app.database.connection import engine, Base
from app.models import source, crawled_data  # SQLAlchemy'nin tabloyu tanıması için modeli import ediyoruz
# Mevcut satırı bul ve şu şekilde güncelle veya yeni satır olarak ekle:
from app.models.source import Source
from app.models.crawled_data import CrawledData  # <-- YENİ EKLENEN
from app.api.routes import health, sources

# Veritabanı tablolarını fiziksel olarak oluşturur
Base.metadata.create_all(bind=engine)

app = FastAPI(title="OSINT Web Crawler API")

# health dosyasının içindeki router değişkenini buraya çağırıyoruz
app.include_router(health.router, prefix="/api", tags=["Health"])

app.include_router(sources.router, prefix="/api/sources", tags=["Sources"])