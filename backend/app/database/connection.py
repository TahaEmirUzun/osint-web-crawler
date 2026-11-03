import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from app.database.base import Base


# Docker ortamında ve yerel ortamda proje kök dizinindeki data klasörünü hedefler.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///../data/osint_crawler.db")
IS_SQLITE = DATABASE_URL.startswith("sqlite")

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False} if IS_SQLITE else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Mevcut veritabanlarına sonradan eklenen kolonlar (create_all var olan tabloları güncellemez)
SCHEMA_MIGRATIONS = {
    "advisories": {
        "last_updated": "DATETIME",
    },
    "sources": {
        "maximum_pages": "INTEGER DEFAULT 100",
        "last_crawl_status": "VARCHAR",
        "last_crawl_records": "INTEGER",
    },
}

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def apply_schema_migrations():
    inspector = inspect(engine)
    with engine.begin() as connection:
        for table_name, columns in SCHEMA_MIGRATIONS.items():
            if not inspector.has_table(table_name):
                continue
            existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, column_type in columns.items():
                if column_name not in existing_columns:
                    connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"))

def init_db():
    # Veritabanı dosyasının olduğu klasörün var olduğundan emin ol
    if IS_SQLITE:
        db_path = DATABASE_URL.replace("sqlite:///", "")
        db_dir = os.path.dirname(db_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
        
    Base.metadata.create_all(bind=engine)
    apply_schema_migrations()
