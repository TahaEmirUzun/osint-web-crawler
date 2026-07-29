from fastapi import APIRouter, Depends
from typing import List  
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.source import Source
from app.schemas.source import SourceCreate, SourceResponse
from fastapi import APIRouter, Depends, HTTPException

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
    
    
    # 2.1. Veritabanından (Source tablosundan) verileri sorguluyoruz
    sources = db.query(Source).offset(skip).limit(limit).all()
    
    return sources


# 3. Belirli bir ID'ye sahip kaynağı getirmek için GET metodu
@router.get("/{source_id}", response_model=SourceResponse)
def read_source(source_id: int, db: Session = Depends(get_db)):
    
    # 3.1. Veritabanında 'id' sütunu, URL'den gelen 'source_id' ile eşleşen İLK kaydı getirir (.first())
    db_source = db.query(Source).filter(Source.id == source_id).first()
    
    # 3.2. Eğer böyle bir kayıt yoksa (None dönerse), kullanıcıya 404 hatası ver
    if db_source is None:
        raise HTTPException(status_code=404, detail="Aradığınız kaynak bulunamadı")
        
    return db_source


# 4. Mevcut bir kaynağı güncellemek için PUT metodu
@router.put("/{source_id}", response_model=SourceResponse)
def update_source(source_id: int, source_data: SourceCreate, db: Session = Depends(get_db)):
    
    # 4.1. Önce güncellenecek kaydı bul
    db_source = db.query(Source).filter(Source.id == source_id).first()
    
    # 4.2. Kayıt yoksa 404 hatası döndür
    if db_source is None:
        raise HTTPException(status_code=404, detail="Güncellenecek kaynak bulunamadı")
        
    # 4.3. Kayıt bulunduysa, objenin özelliklerini yeni gelen verilerle değiştir
    db_source.name = source_data.name
    db_source.base_url = source_data.base_url
    db_source.enabled = source_data.enabled
    db_source.request_delay = source_data.request_delay
    
    # 4.4. Değişiklikleri fiziksel olarak veritabanına kaydet
    db.commit()
    db.refresh(db_source)
    
    return db_source


# 5. Mevcut bir kaynağı veritabanından silmek için DELETE metodu
@router.delete("/{source_id}")
def delete_source(source_id: int, db: Session = Depends(get_db)):
    
    # 5.1. Önce silinecek kaydı veritabanında bul
    db_source = db.query(Source).filter(Source.id == source_id).first()
    
    # 5.2. Eğer kayıt bulunamazsa 404 hatası döndür
    if db_source is None:
        raise HTTPException(status_code=404, detail="Silinecek kaynak bulunamadı")
        
    # 5.3. Kayıt bulunduysa objeyi veritabanından sil
    db.delete(db_source)
    
    # 5.4. Değişiklikleri fiziksel olarak veritabanına kaydet
    db.commit()
    
    # 5.5. Kullanıcıya işlemin başarılı olduğuna dair bir mesaj döndür
    return {"detail": f"ID {source_id} olan kaynak başarıyla silindi"}

