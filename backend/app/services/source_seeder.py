import json
import logging
import os

from app.core import config
from app.database.connection import SessionLocal
from app.models.source import Source

logger = logging.getLogger("OSINT-Crawler.seeder")


def seed_sources(path: str = None) -> int:
    """Kaynak tablosu boşsa onaylı kaynak listesini (config/sources.json) veritabanına yükler."""
    path = path or config.SEED_SOURCES_FILE
    if not path or not os.path.exists(path):
        return 0

    db = SessionLocal()
    try:
        if db.query(Source).count() > 0:
            return 0
        with open(path, encoding="utf-8") as file:
            definitions = json.load(file)

        added = 0
        for item in definitions:
            if not item.get("name") or not item.get("base_url"):
                continue
            db.add(Source(
                name=item["name"],
                base_url=item["base_url"],
                enabled=bool(item.get("enabled", True)),
                request_delay_seconds=int(item.get("request_delay_seconds", 2)),
                maximum_pages=int(item.get("maximum_pages", 100)),
            ))
            added += 1
        db.commit()
        logger.info("%s onaylı kaynak config dosyasından yüklendi.", added)
        return added
    finally:
        db.close()
