import logging
from datetime import date, datetime
from typing import Iterable, Optional

from sqlalchemy.orm import Session

from app.core.time_utils import utc_now
from app.database.connection import SessionLocal
from app.models.advisory import Advisory
from app.models.crawl_job import CrawlJob
from app.models.crawl_log import CrawlLog
from app.models.source import Source
from app.services.crawler import CrawlerEngine, CrawlerError

logger = logging.getLogger("OSINT-Crawler.runner")

ACTIVE_STATUSES = ("queued", "running", "stopping")
FINISHED_STATUSES = ("completed", "failed", "stopped")


def generate_job_id(db: Session, prefix: str = "crawl") -> str:
    """Dokümandaki formata uygun benzersiz görev kimliği üretir: crawl_20260721_001"""
    day = utc_now().strftime("%Y%m%d")
    sequence = db.query(CrawlJob).filter(CrawlJob.id.like(f"{prefix}_{day}_%")).count() + 1
    while True:
        job_id = f"{prefix}_{day}_{sequence:03d}"
        if not db.query(CrawlJob.id).filter(CrawlJob.id == job_id).first():
            return job_id
        sequence += 1


def add_log(db: Session, job_id: Optional[str], level: str, message: str, source: str = "Multi-Crawl") -> None:
    db.add(CrawlLog(crawl_job_id=job_id, log_level=level, message=message, source=source))
    db.commit()
    getattr(logger, level.lower(), logger.info)("[%s] %s", job_id, message)


def is_stop_requested(job_id: str) -> bool:
    db = SessionLocal()
    try:
        job = db.query(CrawlJob.status).filter(CrawlJob.id == job_id).first()
        return bool(job and job[0] in ("stopping", "stopped"))
    finally:
        db.close()


def matches_keywords(record: dict, keywords: Optional[Iterable[str]]) -> bool:
    keywords = [keyword.lower() for keyword in (keywords or []) if keyword]
    if not keywords:
        return True
    content = " ".join(str(record.get(key) or "") for key in ("title", "description", "cve", "product")).lower()
    return any(keyword in content for keyword in keywords)


def is_after_date(record: dict, date_from: Optional[date]) -> bool:
    published = record.get("publication_date")
    if not date_from or not published:
        return True
    return published.date() >= date_from


def save_records(db: Session, records: list, source: Source, job_id: str, keywords=None, date_from=None) -> tuple:
    """Kayıtları veritabanına yazar. Aynı URL'e sahip kayıtlar yeniden eklenmez, güncellenir."""
    created, updated = 0, 0
    seen_urls = set()
    for record in records:
        url = record.get("url")
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        if not matches_keywords(record, keywords) or not is_after_date(record, date_from):
            continue

        existing = db.query(Advisory).filter(Advisory.url == url).first()
        if existing:
            for field_name, value in (
                ("title", record.get("title")),
                ("cve", record.get("cve")),
                ("severity", record.get("severity") if record.get("severity") != "Unknown" else None),
                ("summary", record.get("description")),
                ("organization", record.get("organization")),
                ("publication_date", record.get("publication_date")),
            ):
                if value and getattr(existing, field_name) != value:
                    setattr(existing, field_name, value)
            existing.last_updated = utc_now()
            updated += 1
            continue

        db.add(Advisory(
            title=record.get("title") or "Başlık Bulunamadı",
            url=url,
            summary=record.get("description", ""),
            source_domain=source.base_url,
            organization=record.get("organization"),
            publication_date=record.get("publication_date"),
            cve=record.get("cve"),
            severity=record.get("severity") or "Unknown",
            product=record.get("product") or "Unknown",
            crawl_job_id=job_id,
        ))
        created += 1
    db.commit()
    return created, updated


def run_crawl_job(
    job_id: str,
    source_ids: list,
    maximum_pages: int = 100,
    max_depth: int = 2,
    keywords: Optional[list] = None,
    date_from: Optional[date] = None,
) -> None:
    """Arka planda çalışan tarama görevi. API isteklerini bloklamaz, ilerlemeyi veritabanına yazar."""
    db = SessionLocal()
    try:
        job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
        if not job:
            return
        if job.status in ("stopping", "stopped"):
            job.status = "stopped"
            job.completed_date = utc_now()
            db.commit()
            add_log(db, job_id, "INFO", "Tarama görevi başlamadan durduruldu.")
            return

        job.status = "running"
        job.progress = 5
        db.commit()
        add_log(db, job_id, "INFO", f"Tarama görevi başlatıldı. Toplam {len(source_ids)} kaynak taranacak.")

        total_sources = max(len(source_ids), 1)
        total_records, total_pages, successful_sources = 0, 0, 0

        for index, source_id in enumerate(source_ids):
            if is_stop_requested(job_id):
                break

            remaining_pages = maximum_pages - total_pages
            if remaining_pages <= 0:
                add_log(db, job_id, "INFO", f"Maksimum sayfa sınırına ({maximum_pages}) ulaşıldı.")
                break

            source = db.query(Source).filter(Source.id == source_id).first()
            if not source:
                job.error_count += 1
                db.commit()
                add_log(db, job_id, "WARNING", f"Kaynak [ID: {source_id}] bulunamadı, atlandı.")
                continue
            if not source.enabled:
                add_log(db, job_id, "WARNING", f"'{source.name}' kaynağı pasif durumda, atlandı.", source.base_url)
                continue

            base_progress = 5 + int(index / total_sources * 90)
            job.progress = max(job.progress or 0, base_progress)
            db.commit()
            add_log(db, job_id, "INFO", f"'{source.name}' kaynağı taranıyor ({source.base_url})...", source.base_url)

            source_page_limit = min(remaining_pages, source.maximum_pages or maximum_pages)
            pages_before = total_pages

            def on_page(partial_result, base=base_progress, limit=source_page_limit, before=pages_before):
                job.pages_visited = before + partial_result.pages_visited
                share = 90 / total_sources
                job.progress = min(95, base + int(share * partial_result.pages_visited / max(limit, 1)))
                db.commit()

            engine = CrawlerEngine(
                delay=source.request_delay_seconds or 2,
                max_pages=source_page_limit,
                max_depth=max_depth,
                should_stop=lambda: is_stop_requested(job_id),
                on_page=on_page,
            )

            try:
                result = engine.crawl(source.base_url)
            except CrawlerError as exc:
                job.error_count += 1
                source.last_crawl_date = utc_now()
                source.last_crawl_status = "failed"
                source.last_crawl_records = 0
                db.commit()
                add_log(db, job_id, "ERROR", f"'{source.name}' taranamadı: {exc}", source.base_url)
                continue
            except Exception:
                logger.exception("Kaynak taranırken beklenmeyen hata: %s", source.base_url)
                job.error_count += 1
                source.last_crawl_status = "failed"
                db.commit()
                add_log(db, job_id, "ERROR", f"'{source.name}' taranırken beklenmeyen bir hata oluştu.", source.base_url)
                continue

            created, updated = save_records(db, result.records, source, job_id, keywords, date_from)
            total_records += created
            total_pages += result.pages_visited
            successful_sources += 1

            job.pages_visited = total_pages
            job.records_extracted = total_records
            job.error_count += result.errors
            source.last_crawl_date = utc_now()
            source.last_crawl_status = "blocked" if result.blocked else "completed"
            source.last_crawl_records = created
            db.commit()

            for message in result.error_messages[:5]:
                add_log(db, job_id, "WARNING", message, source.base_url)
            if result.blocked:
                add_log(db, job_id, "WARNING", "Tekrarlanan erişim engeli (403/429) nedeniyle kaynak taraması durduruldu.", source.base_url)
            add_log(
                db, job_id, "INFO",
                f"'{source.name}' taraması bitti. {result.pages_visited} sayfa, {created} yeni, {updated} güncellenen zafiyet.",
                source.base_url,
            )

        db.refresh(job)
        job.completed_date = utc_now()
        job.records_extracted = total_records
        job.pages_visited = total_pages
        if job.status == "stopping" or is_stop_requested(job_id):
            job.status = "stopped"
            db.commit()
            add_log(db, job_id, "WARNING", f"Tarama görevi kullanıcı tarafından durduruldu. {total_records} yeni zafiyet kaydedildi.")
        elif successful_sources == 0 and job.error_count > 0:
            job.status = "failed"
            db.commit()
            add_log(db, job_id, "ERROR", "Tarama görevi başarısız oldu: hiçbir kaynak taranamadı.")
        else:
            job.status = "completed"
            job.progress = 100
            db.commit()
            add_log(db, job_id, "INFO", f"Tarama görevi başarıyla tamamlandı. Toplam {total_records} yeni zafiyet sisteme işlendi.")

    except Exception:
        logger.exception("Tarama görevi çöktü: %s", job_id)
        db.rollback()
        job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
        if job:
            job.status = "failed"
            job.error_count = (job.error_count or 0) + 1
            job.completed_date = utc_now()
            db.commit()
        add_log(db, job_id, "ERROR", "Tarama görevi beklenmeyen bir hata nedeniyle sonlandı.")
    finally:
        db.close()


def recover_interrupted_jobs() -> int:
    """Sunucu yeniden başladığında yarıda kalan görevleri 'failed' olarak işaretler."""
    db = SessionLocal()
    try:
        jobs = db.query(CrawlJob).filter(CrawlJob.status.in_(ACTIVE_STATUSES)).all()
        for job in jobs:
            job.status = "stopped" if job.status == "stopping" else "failed"
            job.completed_date = job.completed_date or utc_now()
            db.add(CrawlLog(crawl_job_id=job.id, log_level="WARNING", message="Sunucu yeniden başlatıldığı için görev yarıda kaldı.", source="System"))
        db.commit()
        return len(jobs)
    finally:
        db.close()


def to_date(value) -> Optional[date]:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str) and value:
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None
    return None
