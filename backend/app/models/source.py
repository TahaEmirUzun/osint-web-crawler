from sqlalchemy import Column, Integer, String, Boolean, DateTime
from datetime import datetime
from app.database.connection import Base
from sqlalchemy.orm import relationship

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

    # 2.1. YENİ: CrawledData ile bağlantı (Source silinirse ona ait veriler de silinsin diye cascade ekliyoruz)
    crawled_data = relationship("CrawledData", back_populates="source", cascade="all, delete-orphan")