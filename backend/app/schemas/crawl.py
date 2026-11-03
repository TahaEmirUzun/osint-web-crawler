from datetime import date
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from app.core import config


class CrawlRequest(BaseModel):
    source_ids: List[int] = Field(..., min_length=1, max_length=50)
    maximum_pages: int = Field(100, ge=1, le=config.CRAWLER_MAX_PAGES_LIMIT)
    max_depth: int = Field(2, ge=1, le=config.CRAWLER_MAX_DEPTH_LIMIT)
    date_from: Optional[date] = None
    keywords: Optional[List[str]] = Field(None, max_length=20)

    @field_validator("source_ids")
    @classmethod
    def unique_source_ids(cls, value: List[int]) -> List[int]:
        if any(source_id <= 0 for source_id in value):
            raise ValueError("Kaynak ID değerleri pozitif olmalıdır.")
        return list(dict.fromkeys(value))

    @field_validator("keywords")
    @classmethod
    def clean_keywords(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value is None:
            return None
        cleaned = [keyword.strip() for keyword in value if keyword and keyword.strip()]
        if any(len(keyword) > 100 for keyword in cleaned):
            raise ValueError("Anahtar kelimeler en fazla 100 karakter olabilir.")
        return cleaned or None


class CrawlStartResponse(BaseModel):
    job_id: str
    status: str
