from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime , timezone
from app.database.base import Base

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
    collection_date = Column(DateTime, default=datetime.now(timezone.utc))
    crawl_job_id = Column(String, ForeignKey("crawl_jobs.id"), nullable=True)