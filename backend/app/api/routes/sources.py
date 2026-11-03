import csv
import io
from typing import List
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.database.connection import get_db
from app.models.advisory import Advisory
from app.models.source import Source
from app.schemas.advisory import AdvisoryResponse
from app.schemas.source import RobotsCheckResponse, SourceCreate, SourceResponse, SourceStatusUpdate, SourceUpdate
from app.services.crawler import RobotsCache, create_session
from app.services.security import get_url_rejection_reason

router = APIRouter()


def get_source_or_404(db: Session, source_id: int) -> Source:
    db_source = db.query(Source).filter(Source.id == source_id).first()
    if db_source is None:
        raise APIError(404, "SOURCE_NOT_FOUND", "İstenen kaynak bulunamadı.")
    return db_source


def ensure_unique_url(db: Session, base_url: str, exclude_id: int = None) -> None:
    query = db.query(Source).filter(Source.base_url == base_url)
    if exclude_id is not None:
        query = query.filter(Source.id != exclude_id)
    if query.first():
        raise APIError(409, "SOURCE_ALREADY_EXISTS", "Bu adres (base_url) zaten sistemde kayıtlı.")


@router.post("", response_model=SourceResponse, status_code=201)
@router.post("/", include_in_schema=False, response_model=SourceResponse, status_code=201)
def create_source(source_data: SourceCreate, db: Session = Depends(get_db)):
    ensure_unique_url(db, source_data.base_url)
    db_source = Source(**source_data.model_dump())
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    return db_source

@router.get("", response_model=List[SourceResponse])
@router.get("/", include_in_schema=False, response_model=List[SourceResponse])
def read_sources(skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    return db.query(Source).order_by(Source.id).offset(skip).limit(limit).all()

@router.get("/{source_id}", response_model=SourceResponse)
def read_source(source_id: int, db: Session = Depends(get_db)):
    return get_source_or_404(db, source_id)

@router.put("/{source_id}", response_model=SourceResponse)
def update_source(source_id: int, source_data: SourceUpdate, db: Session = Depends(get_db)):
    db_source = get_source_or_404(db, source_id)
    ensure_unique_url(db, source_data.base_url, exclude_id=source_id)

    for field_name, value in source_data.model_dump().items():
        setattr(db_source, field_name, value)
    db.commit()
    db.refresh(db_source)
    return db_source

# Kaynağı aktif/pasif yapma ucu
@router.patch("/{source_id}/status", response_model=SourceResponse)
def update_source_status(source_id: int, status_data: SourceStatusUpdate, db: Session = Depends(get_db)):
    db_source = get_source_or_404(db, source_id)
    db_source.enabled = status_data.enabled
    db.commit()
    db.refresh(db_source)
    return db_source

@router.delete("/{source_id}")
def delete_source(source_id: int, db: Session = Depends(get_db)):
    db_source = get_source_or_404(db, source_id)
    db.delete(db_source)
    db.commit()
    return {"detail": f"ID {source_id} olan kaynak başarıyla silindi"}

# Kaynağın robots.txt kurallarının taramaya izin verip vermediğini kontrol eder
@router.get("/{source_id}/robots", response_model=RobotsCheckResponse)
def check_source_robots(source_id: int, db: Session = Depends(get_db)):
    db_source = get_source_or_404(db, source_id)
    parsed = urlparse(db_source.base_url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"

    reason = get_url_rejection_reason(db_source.base_url)
    if reason:
        return {"source_id": source_id, "url": db_source.base_url, "robots_url": robots_url, "allowed": False, "reason": reason}

    session = create_session()
    robots = RobotsCache(session, session.headers["User-Agent"])
    allowed = robots.allowed(db_source.base_url)
    return {
        "source_id": source_id,
        "url": db_source.base_url,
        "robots_url": robots_url,
        "allowed": allowed,
        "reason": None if allowed else "robots.txt bu adresin taranmasına izin vermiyor veya okunamadı.",
    }


# Advisory (Zafiyet) tablosundan veri çekeceğiz
@router.get("/{source_id}/crawled-data", response_model=List[AdvisoryResponse])
def get_crawled_data(source_id: int, db: Session = Depends(get_db)):
    db_source = get_source_or_404(db, source_id)
    return db.query(Advisory).filter(Advisory.source_domain == db_source.base_url).order_by(Advisory.id.desc()).all()


# Dışa aktarma (CSV) formatı Siber Güvenlik standartlarına çekildi
@router.get("/{source_id}/export")
def export_crawled_data_csv(source_id: int, db: Session = Depends(get_db)):
    db_source = get_source_or_404(db, source_id)
    results = db.query(Advisory).filter(Advisory.source_domain == db_source.base_url).order_by(Advisory.id.desc()).all()
    
    stream = io.StringIO()
    csv_writer = csv.writer(stream, delimiter=";")
    csv_writer.writerow(["ID", "URL", "Baslik", "Kurum", "Yayin Tarihi", "CVE", "Kritiklik (Severity)", "Platform/Saglayici", "Tarama Tarihi"])
    
    for row in results:
        csv_writer.writerow([
            row.id,
            row.url,
            row.title,
            row.organization or "",
            row.publication_date.strftime("%Y-%m-%d") if row.publication_date else "",
            row.cve if row.cve else "Bulunamadi",
            row.severity if row.severity else "Unknown",
            row.product if row.product else "Unknown",
            row.collection_date.strftime("%Y-%m-%d %H:%M:%S") if row.collection_date else ""
        ])
        
    raw_csv = stream.getvalue().encode("utf-8")
    bom_csv = b'\xef\xbb\xbf' + raw_csv
    
    return Response(
        content=bom_csv, 
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=osint_source_{source_id}_advisories.csv"}
    )
