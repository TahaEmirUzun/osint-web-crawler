from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.source import Source
from app.models.advisory import Advisory
from app.models.crawl_job import CrawlJob

router = APIRouter()

@router.get("/summary")
def get_statistics_summary(db: Session = Depends(get_db)):
    severity_counts = dict(
        db.query(func.lower(Advisory.severity), func.count(Advisory.id)).group_by(func.lower(Advisory.severity)).all()
    )
    job_counts = dict(db.query(CrawlJob.status, func.count(CrawlJob.id)).group_by(CrawlJob.status).all())

    return {
        "total_advisories": db.query(Advisory).count(),
        "critical": severity_counts.get("critical", 0),
        "high": severity_counts.get("high", 0),
        "medium": severity_counts.get("medium", 0),
        "low": severity_counts.get("low", 0),
        "unknown": sum(count for key, count in severity_counts.items() if key not in ("critical", "high", "medium", "low")),
        "active_sources": db.query(Source).filter(Source.enabled == True).count(),
        "total_sources": db.query(Source).count(),
        "completed_crawls": job_counts.get("completed", 0),
        "failed_crawls": job_counts.get("failed", 0),
        "running_crawls": job_counts.get("running", 0) + job_counts.get("queued", 0) + job_counts.get("stopping", 0),
    }

# Tarihe göre zafiyet istatistikleri
@router.get("/timeline")
def get_statistics_timeline(
    date_field: str = Query("collection_date", pattern="^(collection_date|publication_date)$"),
    db: Session = Depends(get_db),
):
    column = Advisory.collection_date if date_field == "collection_date" else Advisory.publication_date
    timeline_data = (
        db.query(func.date(column).label("date"), func.count(Advisory.id).label("count"))
        .filter(column.isnot(None))
        .group_by(func.date(column))
        .order_by(func.date(column))
        .all()
    )
    return [{"date": str(row.date), "count": row.count} for row in timeline_data]
