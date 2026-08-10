from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database.connection import get_db
from app.models.crawled_data import CrawledData
from app.schemas.crawled_data import CrawledDataResponse

router = APIRouter()

# Toplanan tüm verileri listeleme (Sayfalama ve Filtreleme destekli)
@router.get("/", response_model=List[CrawledDataResponse])
def get_all_crawled_data(
    skip: int = Query(0, description="Atlanacak kayıt sayısı (Sayfalama için)"),
    limit: int = Query(50, description="Getirilecek maksimum kayıt sayısı"),
    source_id: Optional[int] = Query(None, description="Belirli bir kaynağa (Source ID) göre filtrele"),
    keyword: Optional[str] = Query(None, description="Başlık veya URL içinde kelime ara"),
    db: Session = Depends(get_db)
):
    # 1. Temel veritabanı sorgusunu başlat
    query = db.query(CrawledData)

    # 2. FİLTRELEME: Eğer kullanıcı belirli bir kaynak ID'si gönderdiyse
    if source_id:
        query = query.filter(CrawledData.source_id == source_id)

    # 3. ARAMA: Eğer kullanıcı bir kelime (keyword) gönderdiyse
    if keyword:
        # Kelimeyi içerenleri bulmak için LIKE sorgusu formatı (%kelime%)
        search_format = f"%{keyword}%"
        # Başlık VEYA URL içinde bu kelimeyi ara (ilike ile büyük/küçük harf duyarsız)
        query = query.filter(
            (CrawledData.title.ilike(search_format)) | 
            (CrawledData.url.ilike(search_format))
        )

    # 4. SAYFALAMA VE SIRALAMA: En son tarananlar en üstte (desc) gelsin
    results = query.order_by(CrawledData.id.desc()).offset(skip).limit(limit).all()

    return results