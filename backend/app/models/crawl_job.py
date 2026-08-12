from sqlalchemy import Column, Integer, String, DateTime, JSON
from datetime import datetime
from app.database.base import Base

class CrawlJob(Base):
    __tablename__ = "crawl_jobs"
    
    id = Column(String, primary_key=True, index=True) # Örn: "crawl_20260721_001"
    status = Column(String, default="queued") # queued, running, completed, failed, stopped
    progress = Column(Integer, default=0)
    started_date = Column(DateTime, default=datetime.utcnow)
    completed_date = Column(DateTime, nullable=True)
    pages_visited = Column(Integer, default=0)
    records_extracted = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    configuration = Column(JSON, nullable=True)