from sqlalchemy import Column, Integer, String, Boolean, DateTime
from datetime import datetime
from app.database.base import Base

class Source(Base):
    __tablename__ = "sources"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    base_url = Column(String, unique=True, index=True)
    enabled = Column(Boolean, default=True)
    request_delay_seconds = Column(Integer, default=2) # Dokümana göre ismi güncellendi
    created_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_crawl_date = Column(DateTime, nullable=True)