import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.core import config
from app.database.connection import SessionLocal
from app.models.source import Source
from app.models.crawl_job import CrawlJob
from app.models.crawl_log import CrawlLog
from app.services.crawl_runner import generate_job_id, run_crawl_job

logger = logging.getLogger("OSINT-Crawler.scheduler")

scheduler = BackgroundScheduler()

def auto_crawl_task():
    db = SessionLocal()
    try:
        db.add(CrawlLog(
            log_level="INFO",
            message="OTOPİLOT AKTİF: Periyodik tarama başlatıldı. Kaynaklar kontrol ediliyor...",
            source="Scheduler"
        ))
        db.commit()

        if db.query(CrawlJob).filter(CrawlJob.status.in_(["queued", "running", "stopping"])).count() > 0:
            db.add(CrawlLog(log_level="INFO", message="Devam eden bir tarama olduğu için otomatik tarama ertelendi.", source="Scheduler"))
            db.commit()
            return

        source_ids = [source.id for source in db.query(Source).filter(Source.enabled == True).all()]
        if not source_ids:
            db.add(CrawlLog(log_level="INFO", message="Taranacak aktif kaynak bulunamadı.", source="Scheduler"))
            db.commit()
            return

        job_id = generate_job_id(db, prefix="auto")
        db.add(CrawlJob(
            id=job_id,
            status="queued",
            configuration={"source_ids": source_ids, "maximum_pages": config.CRAWLER_MAX_PAGES_LIMIT, "max_depth": 2, "trigger": "scheduler"},
        ))
        db.commit()
    finally:
        db.close()

    run_crawl_job(job_id, source_ids, maximum_pages=config.CRAWLER_MAX_PAGES_LIMIT, max_depth=2)

def start_scheduler():
    if config.AUTO_CRAWL_INTERVAL_HOURS <= 0:
        logger.info("Otomatik tarama kapalı (AUTO_CRAWL_INTERVAL_HOURS=0).")
        return
    scheduler.add_job(auto_crawl_task, 'interval', hours=config.AUTO_CRAWL_INTERVAL_HOURS, id='auto_crawl_job', replace_existing=True)
    scheduler.start()

def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
