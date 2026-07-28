from fastapi import FastAPI
from app.api.routes import health
from app.database.connection import engine, Base
from app.models import source  # SQLAlchemy'nin tabloyu tanıması için modeli import ediyoruz
from app.api.routes import health, sources

# Veritabanı tablolarını fiziksel olarak oluşturur
Base.metadata.create_all(bind=engine)

app = FastAPI(title="OSINT Web Crawler API")

# health dosyasının içindeki router değişkenini buraya çağırıyoruz
app.include_router(health.router, prefix="/api", tags=["Health"])

app.include_router(sources.router, prefix="/api/sources", tags=["Sources"])