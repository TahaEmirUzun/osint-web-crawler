from datetime import datetime, timezone


def utc_now() -> datetime:
    """Veritabanında saklanan tüm zaman damgaları için timezone bilgisi olmayan UTC zamanı döndürür."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
