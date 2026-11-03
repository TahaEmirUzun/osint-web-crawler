from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AdvisoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: Optional[str] = None
    organization: Optional[str] = None
    publication_date: Optional[datetime] = None
    url: Optional[str] = None
    source_domain: Optional[str] = None
    cve: Optional[str] = None
    product: Optional[str] = None
    severity: Optional[str] = None
    summary: Optional[str] = None
    collection_date: Optional[datetime] = None
    last_updated: Optional[datetime] = None
    crawl_job_id: Optional[str] = None
