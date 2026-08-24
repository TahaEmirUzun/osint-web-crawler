from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
from app.database.connection import SessionLocal 
from app.models.source import Source 
from app.services.crawler import scrape_basic_info
from app.models.advisory import Advisory
from app.models.crawl_job import CrawlJob
from app.models.crawl_log import CrawlLog

scheduler = BackgroundScheduler()

def auto_crawl_task():
    db = SessionLocal()
    try:
        # Başlangıç logu
        start_log = CrawlLog(
            log_level="INFO", 
            message="OTOPİLOT AKTİF: Periyodik tarama başlatıldı. Kaynaklar kontrol ediliyor...", 
            source="Scheduler"
        )
        db.add(start_log)
        db.commit()
        
        sources = db.query(Source).filter(Source.enabled == True).all()
        
        if not sources:
            empty_log = CrawlLog(log_level="INFO", message="Taranacak aktif kaynak bulunamadı.", source="Scheduler")
            db.add(empty_log)
            db.commit()
            return
            
        for source in sources:
            job_id = f"auto_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{source.id}"
            
            yeni_job = CrawlJob(
                id=job_id,
                status="running",
                started_date=datetime.now()
            )
            db.add(yeni_job)
            db.commit()
            
            try:
                scraped_data_list = scrape_basic_info(source.base_url)
                
                if scraped_data_list:
                    kayit_sayisi = 0
                    for data in scraped_data_list:
                        if isinstance(data, list) and len(data) > 0:
                            data = data[0]
                        if not isinstance(data, dict):
                            continue
                        
                        mevcut_kayit = db.query(Advisory).filter(Advisory.url == data.get("url")).first()
                        if not mevcut_kayit:
                            yeni_kayit = Advisory(
                                title=data.get("title", "Başlık Bulunamadı"),
                                url=data.get("url"),
                                summary=data.get("description", ""),
                                source_domain=source.base_url,
                                crawl_job_id=job_id
                            )
                            db.add(yeni_kayit)
                            kayit_sayisi += 1
                    
                    yeni_job.status = "completed"
                    yeni_job.completed_date = datetime.now()
                    yeni_job.records_extracted = kayit_sayisi
                    yeni_job.pages_visited = len(scraped_data_list)
                    source.last_crawl_date = datetime.now()
                    
                    # Başarı logu
                    success_log = CrawlLog(
                        crawl_job_id=job_id, 
                        log_level="INFO", 
                        message=f"Tarama tamamlandı. {kayit_sayisi} yeni zafiyet eklendi.", 
                        source=source.base_url
                    )
                    db.add(success_log)
                    db.commit()
                    
            except Exception as e:
                yeni_job.status = "failed"
                yeni_job.error_count += 1
                yeni_job.completed_date = datetime.now()
                
                hata_log = CrawlLog(
                    crawl_job_id=job_id, 
                    log_level="ERROR", 
                    message=f"Hata oluştu: {str(e)}", 
                    source=source.base_url
                )
                db.add(hata_log)
                db.commit()
            
    finally:
        db.close()

def start_scheduler():
    scheduler.add_job(auto_crawl_task, 'interval', hours=12, id='auto_crawl_job', replace_existing=True)
    scheduler.start()
