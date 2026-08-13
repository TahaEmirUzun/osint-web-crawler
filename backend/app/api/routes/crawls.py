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
    date_from: Optional[str] = None
    keywords: Optional[List[str]] = None

# Arka Plan Görevi: Birden fazla kaynağı sırayla taramak
def run_multi_crawler_task(source_ids: List[int], job_id: str):
    db = next(get_db())
    try:
        job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
        toplam_kayit = 0
        toplam_sayfa = 0
        
        for source_id in source_ids:
            source = db.query(Source).filter(Source.id == source_id).first()
            if not source or not source.enabled:
                continue
                
            scraped_data_list = scrape_basic_info(source.base_url)

            # Eğer url geçersizse veya veri dönmediyse loga yaz
            if not scraped_data_list:
                uyari_log = CrawlLog(
                    crawl_job_id=job_id, 
                    log_level="WARNING", 
                    # mesaj kısmına kaynak id'sini (source.id) ekliyoruz ki loglarda hangi kaynağın taranamadığını görebilelim:
                    message=f"Kaynak [ID: {source.id}] taranamadı veya URL güvenli değil.", 
                    source=source.base_url
                )
                db.add(uyari_log)
                continue # Diğer kaynağa geç
            
            
            if scraped_data_list:
                for data in scraped_data_list:
                    # --- ZIRH KODLARI ---
                    if isinstance(data, list) and len(data) > 0:
                        data = data[0]
                    if not isinstance(data, dict):
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
            job.completed_date = datetime.utcnow()
            job.records_extracted = toplam_kayit
            job.pages_visited = toplam_sayfa
            
        db.commit()
        print(f"🎉 Çoklu tarama tamamlandı! Job ID: {job_id}")
        
    except Exception as e:
        print(f"Hata: {e}")
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
    
    background_tasks.add_task(run_multi_crawler_task, request.source_ids, job_id)
    
    # Dokümanda istenen tam yanıt formatı
    return {
        "job_id": job_id,
        "status": "queued"
    }

# Tüm tarama görevlerini (Jobs) listele
@router.get("/")
def list_crawl_jobs(db: Session = Depends(get_db)):
    # En son başlatılan görev en üstte gelecek şekilde (desc) sıralıyoruz
    return db.query(CrawlJob).order_by(CrawlJob.started_date.desc()).all()

# Belirli bir görevin (Job ID) güncel durumunu getir
@router.get("/{job_id}")
def get_crawl_status(job_id: str, db: Session = Depends(get_db)):
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Aranan görev (Job) bulunamadı.")
    return job

# Çalışan bir görevi durdur
@router.post("/{job_id}/stop")
def stop_crawl_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Aranan görev bulunamadı.")
    
    # Eğer görev zaten bitmiş veya durdurulmuşsa işlem yapma
    if job.status in ["completed", "failed", "stopped"]:
        return {"message": "Bu görev zaten sonlanmış durumda.", "current_status": job.status}
        
    # Görevin durumunu "stopped" olarak güncelle
    job.status = "stopped"
    db.commit()
    return {"message": f"{job_id} numaralı görev başarıyla durduruldu.", "status": "stopped"}