from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core import config
from app.services.security import get_url_rejection_reason


class SourceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    base_url: str = Field(..., min_length=8, max_length=2048)
    enabled: bool = True
    request_delay_seconds: int = Field(2, ge=config.CRAWLER_MIN_DELAY_SECONDS, le=60)
    maximum_pages: int = Field(100, ge=1, le=config.CRAWLER_MAX_PAGES_LIMIT)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Kaynak adı boş olamaz.")
        return value

    @field_validator("base_url")
    @classmethod
    def validate_base_url(cls, value: str) -> str:
        value = value.strip()
        # DNS kontrolü tarama anında yapılır; burada format ve iç ağ adresleri reddedilir.
        reason = get_url_rejection_reason(value, resolve=False)
        if reason:
            raise ValueError(reason)
        return value


class SourceCreate(SourceBase):
    pass


class SourceUpdate(SourceBase):
    pass


class SourceStatusUpdate(BaseModel):
    enabled: bool


class SourceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    base_url: str
    enabled: bool
    request_delay_seconds: int
    maximum_pages: Optional[int] = 100
    created_date: Optional[datetime] = None
    updated_date: Optional[datetime] = None
    last_crawl_date: Optional[datetime] = None
    last_crawl_status: Optional[str] = None
    last_crawl_records: Optional[int] = None


class RobotsCheckResponse(BaseModel):
    source_id: int
    url: str
    robots_url: str
    allowed: bool
    reason: Optional[str] = None
