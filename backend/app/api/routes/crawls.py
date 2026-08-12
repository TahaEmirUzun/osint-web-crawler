from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.crawl_job import CrawlJob

router = APIRouter()

# Dokümanda istenen: Tüm tarama görevlerini (Jobs) listele
@router.get("/")
def list_crawl_jobs(db: Session = Depends(get_db)):
    # En son başlatılan görev en üstte gelecek şekilde (desc) sıralıyoruz
    return db.query(CrawlJob).order_by(CrawlJob.started_date.desc()).all()

# Dokümanda istenen: Belirli bir görevin (Job ID) güncel durumunu getir
@router.get("/{job_id}")
def get_crawl_status(job_id: str, db: Session = Depends(get_db)):
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Aranan görev (Job) bulunamadı.")
    return job

# Dokümanda istenen: Çalışan bir görevi durdur
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