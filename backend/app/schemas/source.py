from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# 1. Kullanıcıdan yeni kaynak eklerken (POST) beklediğimiz veriler
class SourceCreate(BaseModel):
    name: str
    base_url: str
    enabled: Optional[bool] = True
    request_delay: Optional[int] = 2

# 2. Veritabanından veriyi çekip API'den dışarı (Cevap olarak) döneceğimiz veriler
class SourceResponse(BaseModel):
    id: int
    name: str
    base_url: str
    enabled: bool
    request_delay: int
    created_date: datetime

    class Config:
        from_attributes = True  # SQLAlchemy modellerini Pydantic şemalarına otomatik dönüştürmeyi sağlar