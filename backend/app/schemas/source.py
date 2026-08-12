from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class SourceBase(BaseModel):
    name: str
    base_url: str
    enabled: bool = True
    request_delay_seconds: int = 2  # Dokümandaki formata göre güncellendi

class SourceCreate(SourceBase):
    pass

class SourceResponse(SourceBase):
    id: int
    created_date: datetime
    updated_date: datetime
    last_crawl_date: Optional[datetime] = None

    class Config:
        from_attributes = True