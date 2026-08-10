from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class CrawledDataResponse(BaseModel):
    id: int
    source_id: int
    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    emails: Optional[str] = None
    phones: Optional[str] = None
    links: Optional[str] = None
    created_date: Optional[datetime] = None

    class Config:
        from_attributes = True  # SQLAlchemy ORM objelerini JSON'a çevirmesi için gerekli