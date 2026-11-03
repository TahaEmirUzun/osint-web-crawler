from datetime import date, datetime, time
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.crawl_log import CrawlLog
from app.schemas.log import CrawlLogResponse

router = APIRouter()

# Logları listele ve filtrele
@router.get("", response_model=List[CrawlLogResponse])
@router.get("/", include_in_schema=False, response_model=List[CrawlLogResponse])
def get_logs(
    response: Response,
    level: Optional[str] = Query(None, description="Log seviyesine göre filtrele (INFO, WARNING, ERROR)"),
    job_id: Optional[str] = Query(None, description="Belirli bir göreve (Job ID) ait logları getir"),
    source: Optional[str] = Query(None, description="Kaynak adresine göre filtrele"),
    date_from: Optional[date] = Query(None, description="Bu tarihten itibaren"),
    date_to: Optional[date] = Query(None, description="Bu tarihe kadar"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(CrawlLog)
    
    if level:
        query = query.filter(func.upper(CrawlLog.log_level) == level.strip().upper())
    if job_id:
        query = query.filter(CrawlLog.crawl_job_id == job_id.strip())
    if source:
        query = query.filter(CrawlLog.source.ilike(f"%{source.strip()}%"))
    if date_from:
        query = query.filter(CrawlLog.timestamp >= datetime.combine(date_from, time.min))
    if date_to:
        query = query.filter(CrawlLog.timestamp <= datetime.combine(date_to, time.max))

    response.headers["X-Total-Count"] = str(query.count())
    # En son kayıtlar en üstte görünsün
    return query.order_by(CrawlLog.timestamp.desc(), CrawlLog.id.desc()).offset(skip).limit(limit).all()
