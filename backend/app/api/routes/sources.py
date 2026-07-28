from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.source import Source
from app.schemas.source import SourceCreate, SourceResponse

# Yönlendiricimizi oluşturuyoruz
router = APIRouter()

# Yeni kaynak eklemek için POST metodu kullanıyoruz
# response_model ile çıktımızın SourceResponse şemasına uygun olacağını garanti ediyoruz
@router.post("/", response_model=SourceResponse)
def create_source(source_data: SourceCreate, db: Session = Depends(get_db)):
    
    # 1. Kullanıcıdan (şemadan) gelen veriyi, veritabanı (SQLAlchemy) modeline dönüştürüyoruz
    db_source = Source(
        name=source_data.name,
        base_url=source_data.base_url,
        enabled=source_data.enabled,
        request_delay=source_data.request_delay
    )
    
    # 2. Veritabanı işlemleri
    db.add(db_source)       # Veriyi oturuma ekle
    db.commit()             # Değişiklikleri fiziksel olarak veritabanına kaydet (işle)
    db.refresh(db_source)   # Veritabanı tarafından otomatik oluşturulan ID ve Tarih bilgilerini çek
    
    # 3. Sonucu döndür
    return db_source