from fastapi import FastAPI
from app.api.routes import health

app = FastAPI(title="OSINT Web Crawler API")

# health dosyasının içindeki router değişkenini buraya çağırıyoruz
app.include_router(health.router, prefix="/api", tags=["Health"])