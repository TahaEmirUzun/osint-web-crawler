from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.database.connection import get_db
from app.models.advisory import Advisory 

router = APIRouter()

# 1. Zafiyetleri Listeleme (Sayfalama ve Filtreleme)
@router.get("/")
def get_all_advisories(
    skip: int = Query(0, description="Atlanacak kayıt sayısı"),
    limit: int = Query(500, description="Getirilecek maksimum kayıt sayısı"),
    severity: Optional[str] = Query(None, description="Kritiklik seviyesine göre filtrele"),
    keyword: Optional[str] = Query(None, description="Başlık, URL veya CVE içinde kelime ara"),
    db: Session = Depends(get_db)
):
    query = db.query(Advisory)

    if severity:
        query = query.filter(Advisory.severity.ilike(f"%{severity}%"))

    if keyword:
        search_format = f"%{keyword}%"
        query = query.filter(
            (Advisory.title.ilike(search_format)) | 
            (Advisory.url.ilike(search_format)) |
            (Advisory.cve.ilike(search_format))
        )

    results = query.order_by(Advisory.id.desc()).offset(skip).limit(limit).all()

    advisories_list = []
    for adv in results:
        advisories_list.append({
            "id": adv.id,
            "title": adv.title,
            "url": adv.url,
            "cve": adv.cve,
            "severity": adv.severity,
            "product": adv.product,
            "source_domain": adv.source_domain,
            "collection_date": adv.collection_date.isoformat() if adv.collection_date else None,
            "summary": adv.summary,
            "crawl_job_id": adv.crawl_job_id
        })

    return advisories_list

# 2. Zafiyet Detayı Getirme
@router.get("/{advisory_id}")
def get_advisory_details(advisory_id: int, db: Session = Depends(get_db)):
    advisory = db.query(Advisory).filter(Advisory.id == advisory_id).first()
    if not advisory:
        raise HTTPException(status_code=404, detail="Zafiyet kaydı bulunamadı")
    
    return {
        "id": advisory.id,
        "title": advisory.title,
        "url": advisory.url,
        "cve": advisory.cve,
        "severity": advisory.severity,
        "product": advisory.product,
        "source_domain": advisory.source_domain,
        "collection_date": advisory.collection_date.isoformat() if advisory.collection_date else None,
        "summary": advisory.summary,
        "crawl_job_id": advisory.crawl_job_id
    }

# 3. Zafiyet Silme
@router.delete("/{advisory_id}")
def delete_advisory(advisory_id: int, db: Session = Depends(get_db)):
    advisory = db.query(Advisory).filter(Advisory.id == advisory_id).first()
    if not advisory:
        raise HTTPException(status_code=404, detail="Zafiyet kaydı bulunamadı")
        
    db.delete(advisory)
    db.commit()
    return {"detail": f"ID {advisory_id} olan zafiyet kaydı silindi."}