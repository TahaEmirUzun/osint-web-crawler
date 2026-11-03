from sqlalchemy import Column, Integer, String, DateTime, JSON
from app.database.base import Base
from app.core.time_utils import utc_now

class CrawlJob(Base):
    __tablename__ = "crawl_jobs"
    
    id = Column(String, primary_key=True, index=True) # Örn: "crawl_20260721_001"
    status = Column(String, default="queued") # queued, running, completed, failed, stopping, stopped
    progress = Column(Integer, default=0)
    started_date = Column(DateTime, default=utc_now)
    completed_date = Column(DateTime, nullable=True)
    pages_visited = Column(Integer, default=0)
    records_extracted = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    configuration = Column(JSON, nullable=True)
