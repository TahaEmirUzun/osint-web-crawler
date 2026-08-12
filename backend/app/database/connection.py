from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database.base import Base

# SQLite veritabanı bağlantı yolu
SQLALCHEMY_DATABASE_URL = "sqlite:///../osint_crawler.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Modellerimizi buraya dahil ediyoruz ki veritabanı tabloları otomatik oluşsun
from app.models.source import Source
from app.models.crawl_job import CrawlJob
from app.models.advisory import Advisory
from app.models.crawl_log import CrawlLog

def init_db():
    Base.metadata.create_all(bind=engine)