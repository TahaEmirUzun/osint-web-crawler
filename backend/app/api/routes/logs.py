from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database.connection import get_db
from app.models.crawl_log import CrawlLog

router = APIRouter()

# Logları listele ve filtrele
@router.get("/")
def get_logs(
    level: Optional[str] = Query(None, description="Log seviyesine göre filtrele (INFO, ERROR)"),
    job_id: Optional[str] = Query(None, description="Belirli bir göreve (Job ID) ait logları getir"),
    db: Session = Depends(get_db)
):
    query = db.query(CrawlLog)
    
    if level:
        query = query.filter(CrawlLog.log_level == level)
    if job_id:
        query = query.filter(CrawlLog.crawl_job_id == job_id)
        
    # En son hatalar en üstte görünsün
    return query.order_by(CrawlLog.timestamp.desc()).limit(100).all()