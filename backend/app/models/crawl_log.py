from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from app.database.base import Base
from app.core.time_utils import utc_now

class CrawlLog(Base):
    __tablename__ = "crawl_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    crawl_job_id = Column(String, ForeignKey("crawl_jobs.id"), nullable=True)
    timestamp = Column(DateTime, default=utc_now, index=True)
    log_level = Column(String, default="INFO")
    message = Column(String)
    source = Column(String, nullable=True)
