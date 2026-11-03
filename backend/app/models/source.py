from sqlalchemy import Column, Integer, String, Boolean, DateTime
from app.database.base import Base
from app.core.time_utils import utc_now

class Source(Base):
    __tablename__ = "sources"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    base_url = Column(String, unique=True, index=True)
    enabled = Column(Boolean, default=True)
    request_delay_seconds = Column(Integer, default=2)
    maximum_pages = Column(Integer, default=100)
    created_date = Column(DateTime, default=utc_now)
    updated_date = Column(DateTime, default=utc_now, onupdate=utc_now)
    last_crawl_date = Column(DateTime, nullable=True)
    last_crawl_status = Column(String, nullable=True)
    last_crawl_records = Column(Integer, nullable=True)
