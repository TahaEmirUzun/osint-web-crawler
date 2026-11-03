from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.time_utils import utc_now
from app.database.connection import get_db
from app.models.crawl_job import CrawlJob
from app.models.source import Source
from app.schemas.crawl import CrawlRequest, CrawlStartResponse
from app.services.crawl_runner import FINISHED_STATUSES, add_log, generate_job_id, run_crawl_job

router = APIRouter()

JOB_STATUSES = ("queued", "running", "completed", "failed", "stopping", "stopped")


def serialize_job(job: CrawlJob, source_names: Optional[dict] = None) -> dict:
    configuration = job.configuration or {}
    source_ids = configuration.get("source_ids", [])
    started = job.started_date.isoformat() if job.started_date else None
    completed = job.completed_date.isoformat() if job.completed_date else None
    return {
        "id": job.id,
        "job_id": job.id,
        "status": job.status,
        "progress": job.progress or 0,
        "progress_percentage": job.progress or 0,
        "pages_visited": job.pages_visited or 0,
        "records_extracted": job.records_extracted or 0,
        "error_count": job.error_count or 0,
        "errors": job.error_count or 0,
        "started_date": started,
        "started_at": started,
        "completed_date": completed,
        "completed_at": completed,
        "configuration": configuration,
        "source_ids": source_ids,
        "source_names": [source_names.get(source_id, f"#{source_id}") for source_id in source_ids] if source_names is not None else None,
    }


def get_job_or_404(db: Session, job_id: str) -> CrawlJob:
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise APIError(404, "JOB_NOT_FOUND", "Aranan tarama görevi bulunamadı.")
    return job


@router.post("", response_model=CrawlStartResponse, status_code=202)
@router.post("/", include_in_schema=False, response_model=CrawlStartResponse, status_code=202)
def start_crawl(request: CrawlRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    sources = db.query(Source).filter(Source.id.in_(request.source_ids)).all()
    found_ids = {source.id for source in sources}
    missing_ids = [source_id for source_id in request.source_ids if source_id not in found_ids]
    if missing_ids:
        raise APIError(404, "SOURCE_NOT_FOUND", f"Şu kaynaklar bulunamadı: {', '.join(map(str, missing_ids))}")
    if not any(source.enabled for source in sources):
        raise APIError(400, "NO_ENABLED_SOURCES", "Seçilen kaynakların hiçbiri aktif değil.")

    job_id = generate_job_id(db)
    configuration = request.model_dump(mode="json")
    db.add(CrawlJob(id=job_id, status="queued", progress=0, started_date=utc_now(), configuration=configuration))
    db.commit()

    background_tasks.add_task(
        run_crawl_job,
        job_id,
        request.source_ids,
        maximum_pages=request.maximum_pages,
        max_depth=request.max_depth,
        keywords=request.keywords,
        date_from=request.date_from,
    )
    return {"job_id": job_id, "status": "queued"}


@router.get("")
@router.get("/", include_in_schema=False)
def list_crawl_jobs(
    status: Optional[str] = Query(None, description="Duruma göre filtrele"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(CrawlJob)
    if status:
        if status.lower() not in JOB_STATUSES:
            raise APIError(422, "VALIDATION_ERROR", f"Geçersiz durum. Geçerli değerler: {', '.join(JOB_STATUSES)}")
        query = query.filter(CrawlJob.status == status.lower())
    jobs = query.order_by(CrawlJob.started_date.desc()).offset(skip).limit(limit).all()
    source_names = {source.id: source.name for source in db.query(Source.id, Source.name).all()}
    return [serialize_job(job, source_names) for job in jobs]


@router.get("/{job_id}")
def get_crawl_status(job_id: str, db: Session = Depends(get_db)):
    job = get_job_or_404(db, job_id)
    source_names = {source.id: source.name for source in db.query(Source.id, Source.name).all()}
    return serialize_job(job, source_names)


@router.post("/{job_id}/stop")
def stop_crawl_job(job_id: str, db: Session = Depends(get_db)):
    job = get_job_or_404(db, job_id)

    if job.status in FINISHED_STATUSES:
        raise APIError(409, "JOB_ALREADY_FINISHED", f"Bu görev zaten sonlanmış durumda ({job.status}).")
    if job.status == "stopping":
        return {"message": "Görev zaten durduruluyor.", "job_id": job_id, "status": "stopping"}

    # Arka plandaki görev bir sonraki sayfada bu durumu görüp güvenli şekilde duracak
    job.status = "stopping"
    db.commit()
    add_log(db, job_id, "INFO", "Kullanıcı görevin durdurulmasını istedi.")
    return {"message": f"{job_id} numaralı görev durduruluyor.", "job_id": job_id, "status": "stopping"}
