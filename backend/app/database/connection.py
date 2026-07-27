from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. SQLite veritabanı dosyamızın yolu (Projeyi çalıştırdığımızda bu isimde bir dosya oluşacak)
SQLALCHEMY_DATABASE_URL = "sqlite:///./osint_crawler.db"

# 2. Veritabanı motorunu (engine) oluşturuyoruz
# 'check_same_thread: False' ayarı SQLite'ın FastAPI ile çoklu işlemlerde sorunsuz çalışmasını sağlar
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# 3. Her bir API isteği geldiğinde veritabanıyla konuşmamızı sağlayacak oturum (session) oluşturucu
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. İleride oluşturacağımız tüm tabloların (Models) miras alacağı temel sınıf
Base = declarative_base()