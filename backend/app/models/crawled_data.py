from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database.connection import Base


# 1. Çekilen verileri saklayacağımız veritabanı tablosu
class CrawledData(Base):
    __tablename__ = "crawled_data"

    # 1.1. Benzersiz kimlik numarası (Primary Key)
    id = Column(Integer, primary_key=True, index=True)
    
    # 1.2. Bu verinin hangi kaynağa (Source) ait olduğunu belirten Dış Anahtar (Foreign Key)
    source_id = Column(Integer, ForeignKey("sources.id"), nullable=False)
    
    # 1.3. Çekilen asıl veriler
    url = Column(String, nullable=False)
    title = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    links = Column(JSON, nullable=True)  
    emails = Column(JSON, nullable=True)  
    phones = Column(JSON, nullable=True)  
    status = Column(String, default="success")
    created_date = Column(DateTime, default=datetime.utcnow)

    # 1.4. SQLAlchemy'nin tablolar arası ilişkiyi anlaması için bağlantı
    source = relationship("Source", back_populates="crawled_data")