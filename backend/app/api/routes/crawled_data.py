from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database.connection import get_db
# YENİ MODELİMİZİ İÇERİ AKTARIYORUZ
from app.models.advisory import Advisory 

router = APIRouter()

# Dokümanda istenen: Sayfalama ve Filtreleme destekli Zafiyet listeleme
@router.get("/")
def get_all_advisories(
    skip: int = Query(0, description="Atlanacak kayıt sayısı (Sayfalama için)"),
    limit: int = Query(50, description="Getirilecek maksimum kayıt sayısı"),
    severity: Optional[str] = Query(None, description="Kritiklik seviyesine göre filtrele (Critical, High, Medium, Low)"),
    keyword: Optional[str] = Query(None, description="Başlık, URL veya CVE içinde kelime ara"),
    db: Session = Depends(get_db)
):
    # 1. Temel veritabanı sorgusunu başlat
    query = db.query(Advisory)

    # 2. FİLTRELEME: Eğer kullanıcı belirli bir kritiklik seviyesi gönderdiyse
    if severity:
        query = query.filter(Advisory.severity.ilike(f"%{severity}%"))

    # 3. ARAMA: Eğer kullanıcı bir kelime (keyword) gönderdiyse
    if keyword:
        search_format = f"%{keyword}%"
        # Başlık, URL veya CVE içinde bu kelimeyi ara
        query = query.filter(
            (Advisory.title.ilike(search_format)) | 
            (Advisory.url.ilike(search_format)) |
            (Advisory.cve.ilike(search_format))
        )

    # 4. SAYFALAMA VE SIRALAMA: En son toplanan zafiyetler en üstte gelsin
    results = query.order_by(Advisory.id.desc()).offset(skip).limit(limit).all()

    return results