from sqlalchemy import Column, Integer, String, Boolean, DateTime
from datetime import datetime
from app.database.connection import Base

class Source(Base):
    # Veritabanında oluşacak tablonun adı
    __tablename__ = "sources"

    # Dokümanda istenen sütunların tanımlanması
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    base_url = Column(String, nullable=False)
    enabled = Column(Boolean, default=True)
    request_delay = Column(Integer, default=2)
    created_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_crawl_date = Column(DateTime, nullable=True)