from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional

from app.database.connection import get_db
from app.models.crawl_job import CrawlJob
from app.models.source import Source
from app.models.advisory import Advisory
from app.models.crawl_log import CrawlLog
from app.services.crawler import scrape_basic_info

router = APIRouter()

# Dokümanda İstenen Request Body Şeması
class CrawlRequest(BaseModel):
    source_ids: List[int]
    maximum_pages: Optional[int] = 100
    date_from: Optional[str] = None # Format: YYYY-MM-DD
    keywords: Optional[List[str]] = None

# Arka Plan Görevi: Birden fazla kaynağı sırayla taramak
def run_multi_crawler_task(request: CrawlRequest, job_id: str):
    db = next(get_db())
    try:
        job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
        
        # 1. DÜZELTME: Görev başlar başlamaz statüyü "running" yapıyoruz
        if job:
            job.status = "running"
            job.progress = 0
            db.commit()

        toplam_kayit = 0
        toplam_sayfa = 0
        
        source_ids = request.source_ids
        total_sources = len(source_ids)
        
        for index, source_id in enumerate(source_ids):
            # PROGRESS GÜNCELLEME: Yüzde hesapla
            progress_pct = int((index / total_sources) * 100)
            if job:
                job.progress = progress_pct
                db.commit()
                
            source = db.query(Source).filter(Source.id == source_id).first()
            if not source or not source.enabled:
                continue
                
            scraped_data_list = scrape_basic_info(source.base_url)
            if not scraped_data_list:
                uyari_log = CrawlLog(
                    crawl_job_id=job_id, 
                    log_level="WARNING", 
                    message=f"Kaynak [ID: {source.id}] taranamadı veya URL güvenli değil.", 
                    source=source.base_url
                )
                db.add(uyari_log)
                continue
                
            if scraped_data_list:
                for data in scraped_data_list:
                    if isinstance(data, list) and len(data) > 0:
                        data = data[0]
                    if not isinstance(data, dict):
                        continue
                        
                    # Filtreleme (Keywords)
                    if request.keywords:
                        content_to_search = (data.get("title", "") + " " + data.get("description", "")).lower()
                        if not any(kw.lower() in content_to_search for kw in request.keywords):
                            continue 
                            
                    # Mükerrer Kayıt Kontrolü
                    mevcut_kayit = db.query(Advisory).filter(Advisory.url == data.get("url")).first()
                    if not mevcut_kayit:
                        new_advisory = Advisory(
                            title=data.get("title", "Başlık Bulunamadı"),
                            url=data.get("url"),
                            summary=data.get("description", ""),
                            source_domain=source.base_url,
                            cve=data.get("cve"),
                            severity=data.get("severity", "Unknown"),
                            product=data.get("product", "Unknown"),
                            crawl_job_id=job_id
                        )
                        db.add(new_advisory)
                        toplam_kayit += 1
                        
                toplam_sayfa += len(scraped_data_list)
                source.last_crawl_date = datetime.utcnow()
                
        if job:
            job.status = "completed"
            job.progress = 100 # Tamamlandı
            job.completed_date = datetime.utcnow()
            job.records_extracted = toplam_kayit
            job.pages_visited = toplam_sayfa
            db.commit()

            # 2. DÜZELTME: Manuel tarama bittiğinde Log ekranına başarı mesajı düşür
            basari_log = CrawlLog(
                crawl_job_id=job_id,
                log_level="INFO",
                message=f"Manuel tarama başarıyla tamamlandı. {toplam_kayit} yeni zafiyet bulundu.",
                source="Multi-Crawl"
            )
            db.add(basari_log)
            db.commit()
            
    except Exception as e:
        job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
        if job:
            job.status = "failed"
            job.error_count += 1
            job.completed_date = datetime.utcnow()
            
        hata_log = CrawlLog(crawl_job_id=job_id, log_level="ERROR", message=str(e), source="Multi-Crawl")
        db.add(hata_log)
        db.commit()
    finally:
        db.close()

# Çoklu Tarama Başlatma Ucu
@router.post("/")
def start_crawl(request: CrawlRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    job_id = f"crawl_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    new_job = CrawlJob(
        id=job_id,
        status="queued",
        started_date=datetime.utcnow()
    )
    db.add(new_job)
    db.commit()
    
    # request objesini komple gönderiyoruz
    background_tasks.add_task(run_multi_crawler_task, request, job_id)
    
    return {
        "job_id": job_id,
        "status": "queued"
    }

@router.get("/")
def list_crawl_jobs(db: Session = Depends(get_db)):
    return db.query(CrawlJob).order_by(CrawlJob.started_date.desc()).all()

@router.get("/{job_id}")
def get_crawl_status(job_id: str, db: Session = Depends(get_db)):
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Aranan görev (Job) bulunamadı.")
    return job

@router.post("/{job_id}/stop")
def stop_crawl_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Aranan görev bulunamadı.")
    
    if job.status in ["completed", "failed", "stopped"]:
        return {"message": "Bu görev zaten sonlanmış durumda.", "current_status": job.status}
        
    job.status = "stopped"
    db.commit()
    return {"message": f"{job_id} numaralı görev başarıyla durduruldu.", "status": "stopped"}
