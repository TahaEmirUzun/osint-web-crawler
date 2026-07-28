from fastapi import APIRouter, Depends
from typing import List  
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.source import Source
from app.schemas.source import SourceCreate, SourceResponse

# Yönlendiricimizi oluşturuyoruz
router = APIRouter()

# 1. Yeni kaynak eklemek için POST metodu 
@router.post("/", response_model=SourceResponse)
def create_source(source_data: SourceCreate, db: Session = Depends(get_db)):
    
    db_source = Source(
        name=source_data.name,
        base_url=source_data.base_url,
        enabled=source_data.enabled,
        request_delay=source_data.request_delay
    )
    
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    
    return db_source

# 2. Kaynakları listelemek için GET metodu
@router.get("/", response_model=List[SourceResponse])
def read_sources(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    
    # Veritabanından (Source tablosundan) verileri sorguluyoruz
    sources = db.query(Source).offset(skip).limit(limit).all()
    
    return sources