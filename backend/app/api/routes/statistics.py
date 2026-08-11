from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.source import Source
from app.models.crawled_data import CrawledData

router = APIRouter()

@router.get("/summary")
def get_statistics_summary(db: Session = Depends(get_db)):
    # 1. Veritabanından gelen GERÇEK metriklerimiz
    total_advisories = db.query(CrawledData).count()
    active_sources = db.query(Source).filter(Source.enabled == True).count()
    
    # Not: completed_crawls için şimdilik toplam veri sayısını kullanabiliriz 
    # veya ayrı bir job tablosu olmadığı için temsili bir rakam/hesaplama verebiliriz.
    completed_crawls = total_advisories 

    # 2. Dokümanın İstediği "API Kontratına Uyumlu" Çıktı
    return {
        "total_advisories": total_advisories,
        "critical": 0,  # OSINT modülünde severity ölçmediğimiz için 0 (MVP)
        "high": 0,
        "medium": 0,
        "low": 0,
        "active_sources": active_sources,
        "completed_crawls": completed_crawls
    }