import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.database.connection import engine

router = APIRouter()
logger = logging.getLogger("OSINT-Crawler.health")

@router.get("/health")
def health_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        database_status = "connected"
    except Exception:
        logger.exception("Veritabanı sağlık kontrolü başarısız")
        database_status = "disconnected"

    healthy = database_status == "connected"
    return JSONResponse(
        status_code=200 if healthy else 503,
        content={
            "status": "healthy" if healthy else "unhealthy",
            "database": database_status,
            "crawler": "available",
        },
    )
