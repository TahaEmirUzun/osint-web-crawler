import csv
import io
from datetime import datetime
from typing import List  
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.source import Source
from app.schemas.source import SourceCreate, SourceResponse
from app.services.crawler import scrape_basic_info
from app.models.advisory import Advisory
from app.models.crawl_job import CrawlJob
from app.models.crawl_log import CrawlLog

router = APIRouter()

@router.post("/", response_model=SourceResponse)
def create_source(source_data: SourceCreate, db: Session = Depends(get_db)):
    existing_source = db.query(Source).filter(Source.base_url == source_data.base_url).first()
    if existing_source:
        raise HTTPException(status_code=400, detail="Bu adres (base_url) zaten sistemde kayıtlı!")
    db_source = Source(
        name=source_data.name,
        base_url=source_data.base_url,
        enabled=source_data.enabled,
        request_delay_seconds=source_data.request_delay_seconds
    )
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    return db_source

@router.get("/", response_model=List[SourceResponse])
def read_sources(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    sources = db.query(Source).offset(skip).limit(limit).all()
    return sources

@router.get("/{source_id}", response_model=SourceResponse)
def read_source(source_id: int, db: Session = Depends(get_db)):
    db_source = db.query(Source).filter(Source.id == source_id).first()
    if db_source is None:
        raise HTTPException(status_code=404, detail="Aradığınız kaynak bulunamadı")
    return db_source

@router.put("/{source_id}", response_model=SourceResponse)
def update_source(source_id: int, source_data: SourceCreate, db: Session = Depends(get_db)):
    db_source = db.query(Source).filter(Source.id == source_id).first()
    if db_source is None:
        raise HTTPException(status_code=404, detail="Güncellenecek kaynak bulunamadı")
        
    db_source.name = source_data.name
    db_source.base_url = source_data.base_url
    db_source.enabled = source_data.enabled
    db_source.request_delay_seconds = source_data.request_delay_seconds
    
    db.commit()
    db.refresh(db_source)
    return db_source

@router.delete("/{source_id}")
def delete_source(source_id: int, db: Session = Depends(get_db)):
    db_source = db.query(Source).filter(Source.id == source_id).first()
    if db_source is None:
        raise HTTPException(status_code=404, detail="Silinecek kaynak bulunamadı")
        
    db.delete(db_source)
    db.commit()
    return {"detail": f"ID {source_id} olan kaynak başarıyla silindi"}


# 6. Arka Planda çalışacak olan asıl Tarama ve Kaydetme Fonksiyonu
def run_crawler_task(source_id: int, url: str, job_id: str):
    db = next(get_db())
    
    try:
        # Job'ı veritabanından bul
        job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
        source = db.query(Source).filter(Source.id == source_id).first()
        
        scraped_data_list = scrape_basic_info(url)
        kayit_sayisi = 0
        
        if scraped_data_list:
            for data in scraped_data_list:
                
                # --- ZIRH KODLARI ---
                if isinstance(data, list) and len(data) > 0:
                    data = data[0]
                if not isinstance(data, dict):
                    continue
                # -------------------
                
                # Mükerrer Kayıt Kontrolü (Advisory tablosunda)
                mevcut_kayit = db.query(Advisory).filter(Advisory.url == data.get("url")).first()
                
                if not mevcut_kayit:
                    new_advisory = Advisory(
                        title=data.get("title", "Başlık Bulunamadı"),
                        url=data.get("url"),
                        summary=data.get("description", ""),
                        source_domain=url,
                        cve=data.get("cve"),
                        severity=data.get("severity", "Unknown"),
                        product=data.get("product", "Unknown"),
                        crawl_job_id=job_id
                    )
                    db.add(new_advisory)
                    kayit_sayisi += 1
            
            # Job başarıyla bittiyse güncelle
            if job:
                job.status = "completed"
                job.completed_date = datetime.utcnow()
                job.records_extracted = kayit_sayisi
                job.pages_visited = len(scraped_data_list)
            
            if source:
                source.last_crawl_date = datetime.utcnow()
                
            db.commit()
            print(f"🎉 Manuel tarama tamamlandı! Job ID: {job_id}")
            
    except Exception as e:
        print(f"Arka plan görevinde hata oluştu: {e}")
        # Hata durumunda Job'ı güncelle ve Log yaz
        job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
        if job:
            job.status = "failed"
            job.error_count += 1
            job.completed_date = datetime.utcnow()
            
            hata_log = CrawlLog(crawl_job_id=job_id, log_level="ERROR", message=str(e), source=url)
            db.add(hata_log)
            db.commit()
    finally:
        db.close()


@router.post("/{source_id}/crawl")
def crawl_source(source_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    db_source = db.query(Source).filter(Source.id == source_id).first()
    
    if db_source is None:
        raise HTTPException(status_code=404, detail="Taranacak kaynak bulunamadı")
        
    # YENİ: Tarama tetiklendiği an bir Job oluştur ve veritabanına yaz
    job_id = f"crawl_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{source_id}"
    new_job = CrawlJob(
        id=job_id,
        status="running",
        started_date=datetime.utcnow()
    )
    db.add(new_job)
    db.commit()
        
    # Asıl işi arka plana atarken Job ID'yi de parametre olarak gönder
    background_tasks.add_task(run_crawler_task, source_id, db_source.base_url, job_id)
    
    return {
        "job_id": job_id, 
        "status": "queued",
        "message": f"'{db_source.base_url}' adresini tarama işlemi başlatıldı."
    }

# Advisory (Zafiyet) tablosundan veri çekeceğiz
@router.get("/{source_id}/crawled-data")
def get_crawled_data(source_id: int, db: Session = Depends(get_db)):
    db_source = db.query(Source).filter(Source.id == source_id).first()
    if db_source is None:
        raise HTTPException(status_code=404, detail="Kaynak bulunamadı")
        
    # İlgili kaynağın alan adını içeren advisories'leri getiriyoruz
    results = db.query(Advisory).filter(Advisory.source_domain == db_source.base_url).order_by(Advisory.id.desc()).all()
    return results


# Dışa aktarma formatı Siber Güvenlik standartlarına çekildi
@router.get("/{source_id}/export")
def export_crawled_data_csv(source_id: int, db: Session = Depends(get_db)):
    db_source = db.query(Source).filter(Source.id == source_id).first()
    if not db_source:
        raise HTTPException(status_code=404, detail="Kaynak bulunamadı")
        
    results = db.query(Advisory).filter(Advisory.source_domain == db_source.base_url).order_by(Advisory.id.desc()).all()
    
    stream = io.StringIO()
    csv_writer = csv.writer(stream, delimiter=";")
    csv_writer.writerow(["ID", "URL", "Baslik", "CVE", "Kritiklik (Severity)", "Urun", "Tarama Tarihi"])
    
    for row in results:
        csv_writer.writerow([
            row.id,
            row.url,
            row.title,
            row.cve if row.cve else "Bulunamadi",
            row.severity if row.severity else "Unknown",
            row.product if row.product else "Unknown",
            row.collection_date.strftime("%Y-%m-%d %H:%M:%S") if row.collection_date else ""
        ])
        
    raw_csv = stream.getvalue().encode("utf-8")
    bom_csv = b'\xef\xbb\xbf' + raw_csv
    
    return Response(
        content=bom_csv, 
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename=osint_source_{source_id}_advisories.csv"}
    )