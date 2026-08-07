import csv
import io
from fastapi.responses import StreamingResponse
from fastapi import APIRouter, Depends
from typing import List  
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.source import Source
from app.models.crawled_data import CrawledData
from app.schemas.source import SourceCreate, SourceResponse
from fastapi import APIRouter, Depends, HTTPException
from app.services.crawler import scrape_basic_info
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Response


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


# 6. Arka Planda çalışacak olan asıl Tarama ve Kaydetme Fonksiyonu
def run_crawler_task(source_id: int, url: str):
    
    # 6.1. Background task, ana API isteği bittikten sonra çalıştığı için kendi veritabanı oturumunu manuel açmalıdır
    # (Eğer bunu yapmazsak, ana istek bitince veritabanı kapanır ve kayıt yapılamaz)
    db = next(get_db())
    
    try:
        # 6.2. Dün yazdığımız crawler servisini çalıştır
        result = scrape_basic_info(url)
        
        # 6.3. Başarılıysa CrawledData tablosuna kaydet
        if result.get("status") == "success":
            new_data = CrawledData(
                source_id=source_id,
                url=result["url"],
                title=result["title"],
                description=result["description"],
                links=result["links"],
                emails=result.get("emails", []),  # YENİ
                phones=result.get("phones", [])   # YENİ
            )
            db.add(new_data)
            db.commit()
    except Exception as e:
        print(f"Arka plan görevinde hata oluştu: {e}")
    finally:
        # 6.4. İşlem bitince arka plan veritabanı bağlantısını güvenlice kapat
        db.close()



# 7. Belirli bir kaynağı taramak (crawl) için POST metodu (Arka Plan Görevli)
@router.post("/{source_id}/crawl")
def crawl_source(source_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    
    # 7.1. Veritabanından kaynağı bul
    db_source = db.query(Source).filter(Source.id == source_id).first()
    
    # 7.2. Kayıt yoksa 404 hatası döndür
    if db_source is None:
        raise HTTPException(status_code=404, detail="Taranacak kaynak bulunamadı")
        
    # 7.3. Asıl uzun sürecek olan tarama ve kaydetme işini ARKA PLANA (Background Task) havale et
    background_tasks.add_task(run_crawler_task, source_id, db_source.base_url)
    
    # 7.4. Kullanıcıyı/Arayüzü bekletmeden ANINDA başarılı mesajını dön
    return {
        "status": "success", 
        "message": f"'{db_source.base_url}' adresini tarama işlemi arka planda başlatıldı."
    }


# 8. Belirli bir kaynağa ait taranmış verileri getiren GET metodu
@router.get("/{source_id}/crawled-data")
def get_crawled_data(source_id: int, db: Session = Depends(get_db)):
    
    # 8.1. Önce böyle bir kaynak (Source) var mı diye kontrol et
    db_source = db.query(Source).filter(Source.id == source_id).first()
    
    # 8.2. Kayıt yoksa 404 hatası döndür
    if db_source is None:
        raise HTTPException(status_code=404, detail="Kaynak bulunamadı")
        
    # 8.3. Kaynağa ait taranmış verileri veritabanından çek. 
    # (En son yapılan taramalar en üstte görünsün diye id.desc() ile ters sıralıyoruz)
    results = db.query(CrawledData).filter(CrawledData.source_id == source_id).order_by(CrawledData.id.desc()).all()
    
    # 8.4. Çekilen listeyi doğrudan Swagger'a (arayüze) yansıt
    return results



# 9. Kaynağa ait tarama verilerini CSV olarak dışa aktarma (Export)
@router.get("/{source_id}/export")
def export_crawled_data_csv(source_id: int, db: Session = Depends(get_db)):
    
    # 9.1. Kaynağın var olup olmadığını kontrol et
    db_source = db.query(Source).filter(Source.id == source_id).first()
    if not db_source:
        raise HTTPException(status_code=404, detail="Kaynak bulunamadı")
        
    # 9.2. Kaynağa ait tüm tarama geçmişini veritabanından çek
    results = db.query(CrawledData).filter(CrawledData.source_id == source_id).order_by(CrawledData.id.desc()).all()
    
    # 9.3. RAM üzerinde sanal bir metin dosyası oluştur
    stream = io.StringIO()

    # 9.4. CSV Yazıcıyı başlat ve ilk satıra Kolon Başlıklarını ekle (Virgül yerine noktalı virgül)
    csv_writer = csv.writer(stream, delimiter=";")
    csv_writer.writerow(["ID", "URL", "Baslik", "Bulunan E-postalar", "Bulunan Telefonlar", "Tarama Tarihi"])
    
    # 9.5. Veritabanından gelen her satırı CSV formatında dosyaya ekle
    for row in results:
        # DÜZELTME: Veritabanında zaten düz metin olarak kayıtlı oldukları için .join yapmıyoruz! Doğrudan alıyoruz.
        emails_str = row.emails if row.emails else ""
        phones_str = row.phones if row.phones else ""

        # EXCEL HİLESİ: Telefon numarası "+" ile başlıyorsa formül sanmasını engellemek için başına tek tırnak (') ekledik
        if phones_str and phones_str.startswith("+"):
            phones_str = f"'{phones_str}"
        
        csv_writer.writerow([
            row.id,
            row.url,
            row.title,
            emails_str,
            phones_str,
            row.created_date.strftime("%Y-%m-%d %H:%M:%S") if row.created_date else ""
        ])
        
    # 9.6. Ham UTF-8 metni oluştur ve en başına Manuel olarak BOM (\xef\xbb\xbf) baytlarını ekle ki EXCEL Türkçe karakterleri doğru göstersin
    raw_csv = stream.getvalue().encode("utf-8")
    bom_csv = b'\xef\xbb\xbf' + raw_csv
    
    # 9.7. Dosyayı ham Response ile kullanıcıya "indirilebilir eklenti" olarak sun
    return Response(
        content=bom_csv, 
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename=osint_source_{source_id}_export.csv"}
    )