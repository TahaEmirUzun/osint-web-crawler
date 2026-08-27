from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.connection import get_db
from app.models.source import Source
from app.models.advisory import Advisory
from app.models.crawl_job import CrawlJob

router = APIRouter()

@router.get("/summary")
def get_statistics_summary(db: Session = Depends(get_db)):
    # 1. Toplam toplanan zafiyet (advisory) sayısı
    total_advisories = db.query(Advisory).count()
    
    # 2. Aktif kaynak sayısı
    active_sources = db.query(Source).filter(Source.enabled == True).count()
    
    # 3. Artık Job tablomuz olduğu için tamamlanan görev sayısını GERÇEK olarak alabiliriz
    completed_crawls = db.query(CrawlJob).filter(CrawlJob.status == "completed").count()

    # 4. Veritabanındaki GERÇEK kritiklik (severity) istatistikleri
    critical_count = db.query(Advisory).filter(Advisory.severity == "Critical").count()
    high_count = db.query(Advisory).filter(Advisory.severity == "High").count()
    medium_count = db.query(Advisory).filter(Advisory.severity == "Medium").count()
    low_count = db.query(Advisory).filter(Advisory.severity == "Low").count()

    # 5. Dokümanın İstediği "API Kontratına Uyumlu" Gerçek Çıktı
    return {
        "total_advisories": total_advisories,
        "critical": critical_count,
        "high": high_count,
        "medium": medium_count,
        "low": low_count,
        "active_sources": active_sources,
        "completed_crawls": completed_crawls
    }

# Dokümanda İstenen: Tarihe göre zafiyet istatistikleri
@router.get("/timeline")
def get_statistics_timeline(db: Session = Depends(get_db)):
    # Veritabanındaki kayıtları tarihlerine göre gruplayıp sayıyoruz
    timeline_data = (
        db.query(
            func.date(Advisory.collection_date).label("date"),
            func.count(Advisory.id).label("count")
        )
        .group_by(func.date(Advisory.collection_date))
        .order_by(func.date(Advisory.collection_date))
        .all()
    )
    
    # React'in rahatça okuyabileceği liste formatına çeviriyoruz
    return [{"date": str(row.date), "count": row.count} for row in timeline_data]