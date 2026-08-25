from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.database.connection import get_db
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

# Dokümanda İstenen: Belirli bir zafiyetin detayını getir
@router.get("/{advisory_id}")
def get_advisory_details(advisory_id: int, db: Session = Depends(get_db)):
    advisory = db.query(Advisory).filter(Advisory.id == advisory_id).first()
    if not advisory:
        raise HTTPException(status_code=404, detail="Zafiyet kaydı bulunamadı")
    return advisory

# Dokümanda İstenen: Zafiyet kaydını sil
@router.delete("/{advisory_id}")
def delete_advisory(advisory_id: int, db: Session = Depends(get_db)):
    advisory = db.query(Advisory).filter(Advisory.id == advisory_id).first()
    if not advisory:
        raise HTTPException(status_code=404, detail="Zafiyet kaydı bulunamadı")
        
    db.delete(advisory)
    db.commit()
    return {"detail": f"ID {advisory_id} olan zafiyet kaydı silindi."}