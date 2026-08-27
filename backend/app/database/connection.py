import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database.base import Base


# Docker ortamında ve yerel ortamda proje kök dizinindeki data klasörünü hedefler.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///../data/osint_crawler.db")

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from app.models.source import Source
from app.models.crawl_job import CrawlJob
from app.models.advisory import Advisory
from app.models.crawl_log import CrawlLog

def init_db():
    # Veritabanı dosyasının olduğu klasörün var olduğundan emin ol
    db_path = DATABASE_URL.replace("sqlite:///", "")
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
        
    Base.metadata.create_all(bind=engine)