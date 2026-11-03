from datetime import date, datetime, time
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.database.connection import get_db
from app.models.advisory import Advisory
from app.schemas.advisory import AdvisoryResponse

router = APIRouter()

SORTABLE_FIELDS = {
    "id": Advisory.id,
    "title": Advisory.title,
    "organization": Advisory.organization,
    "publication_date": Advisory.publication_date,
    "severity": Advisory.severity,
    "cve": Advisory.cve,
    "product": Advisory.product,
    "source_domain": Advisory.source_domain,
    "collection_date": Advisory.collection_date,
    "url": Advisory.url,
}


# 1. Zafiyetleri Listeleme (Sayfalama ve Filtreleme)
@router.get("", response_model=List[AdvisoryResponse])
@router.get("/", include_in_schema=False, response_model=List[AdvisoryResponse])
def get_all_advisories(
    response: Response,
    page: Optional[int] = Query(None, ge=1, description="Sayfa numarası (1'den başlar)"),
    page_size: int = Query(25, ge=1, le=500, description="Sayfa başına kayıt"),
    skip: int = Query(0, ge=0, description="Atlanacak kayıt sayısı (page verilmezse kullanılır)"),
    limit: int = Query(500, ge=1, le=1000, description="Getirilecek maksimum kayıt sayısı (page verilmezse kullanılır)"),
    severity: Optional[str] = Query(None, description="Kritiklik seviyesine göre filtrele"),
    organization: Optional[str] = Query(None, description="Yayınlayan kuruma göre filtrele"),
    source: Optional[str] = Query(None, description="Kaynak adresine göre filtrele"),
    product: Optional[str] = Query(None, description="Etkilenen ürüne göre filtrele"),
    keyword: Optional[str] = Query(None, max_length=200, description="Başlık, özet, URL veya CVE içinde kelime ara"),
    date_from: Optional[date] = Query(None, description="Bu tarihten sonraki kayıtlar (yayın, yoksa toplama tarihi)"),
    date_to: Optional[date] = Query(None, description="Bu tarihten önceki kayıtlar"),
    sort_by: str = Query("id", description=f"Sıralama alanı: {', '.join(SORTABLE_FIELDS)}"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db)
):
    query = db.query(Advisory)

    if severity:
        query = query.filter(func.lower(Advisory.severity) == severity.strip().lower())
    if organization:
        query = query.filter(Advisory.organization.ilike(f"%{organization.strip()}%"))
    if source:
        query = query.filter(Advisory.source_domain.ilike(f"%{source.strip()}%"))
    if product:
        query = query.filter(Advisory.product.ilike(f"%{product.strip()}%"))
    if keyword:
        search_format = f"%{keyword.strip()}%"
        query = query.filter(or_(
            Advisory.title.ilike(search_format),
            Advisory.summary.ilike(search_format),
            Advisory.url.ilike(search_format),
            Advisory.cve.ilike(search_format),
        ))

    effective_date = func.coalesce(Advisory.publication_date, Advisory.collection_date)
    if date_from:
        query = query.filter(effective_date >= datetime.combine(date_from, time.min))
    if date_to:
        query = query.filter(effective_date <= datetime.combine(date_to, time.max))

    if sort_by not in SORTABLE_FIELDS:
        raise APIError(422, "VALIDATION_ERROR", f"Geçersiz sıralama alanı. Geçerli değerler: {', '.join(SORTABLE_FIELDS)}")
    sort_column = SORTABLE_FIELDS[sort_by]
    query = query.order_by(sort_column.asc() if sort_order == "asc" else sort_column.desc(), Advisory.id.desc())

    total = query.count()
    if page is not None:
        offset, size = (page - 1) * page_size, page_size
    else:
        offset, size = skip, limit

    response.headers["X-Total-Count"] = str(total)
    return query.offset(offset).limit(size).all()

# 2. Zafiyet Detayı Getirme
@router.get("/{advisory_id}", response_model=AdvisoryResponse)
def get_advisory_details(advisory_id: int, db: Session = Depends(get_db)):
    advisory = db.query(Advisory).filter(Advisory.id == advisory_id).first()
    if not advisory:
        raise APIError(404, "ADVISORY_NOT_FOUND", "Zafiyet kaydı bulunamadı.")
    return advisory

# 3. Zafiyet Silme
@router.delete("/{advisory_id}")
def delete_advisory(advisory_id: int, db: Session = Depends(get_db)):
    advisory = db.query(Advisory).filter(Advisory.id == advisory_id).first()
    if not advisory:
        raise APIError(404, "ADVISORY_NOT_FOUND", "Zafiyet kaydı bulunamadı.")
        
    db.delete(advisory)
    db.commit()
    return {"detail": f"ID {advisory_id} olan zafiyet kaydı silindi."}
