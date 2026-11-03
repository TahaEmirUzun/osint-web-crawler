from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class CrawlLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    crawl_job_id: Optional[str] = None
    timestamp: Optional[datetime] = None
    log_level: str
    message: str
    source: Optional[str] = None
