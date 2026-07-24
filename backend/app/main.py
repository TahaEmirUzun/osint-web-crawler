from fastapi import FastAPI

# FastAPI uygulamamızı başlatıyoruz
app = FastAPI(title="OSINT Web Crawler API")

# Dokümanda istenen Health Check (Sağlık Kontrolü) endpoint'i
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "database": "connected",
        "crawler": "available"
    }