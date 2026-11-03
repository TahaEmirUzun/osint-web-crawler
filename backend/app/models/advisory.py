from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from app.database.base import Base
from app.core.time_utils import utc_now

class Advisory(Base):
    __tablename__ = "advisories"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=True)
    organization = Column(String, nullable=True)
    publication_date = Column(DateTime, nullable=True)
    url = Column(String, index=True)
    source_domain = Column(String, nullable=True)
    cve = Column(String, nullable=True)
    product = Column(String, nullable=True)
    severity = Column(String, nullable=True)
    summary = Column(String, nullable=True)
    collection_date = Column(DateTime, default=utc_now)
    last_updated = Column(DateTime, default=utc_now, onupdate=utc_now)
    crawl_job_id = Column(String, ForeignKey("crawl_jobs.id"), nullable=True)
