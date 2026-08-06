from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
from app.database.connection import SessionLocal # Veritabanı oturumu açmak için
from app.models.source import Source # Kaynaklar tablomuz
from app.services.crawler import scrape_basic_info

scheduler = BackgroundScheduler()

def auto_crawl_task():
    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] OTOPİLOT AKTİF: Veritabanı kontrol ediliyor...")
    
    # 1. Otopilot için manuel bir veritabanı penceresi (session) açıyoruz
    db = SessionLocal()
    try:
        # 2. Veritabanındaki tüm hedefleri çekiyoruz
        sources = db.query(Source).all()
        
        if not sources:
            print("Veritabanında taranacak hedef bulunamadı.")
            return
            
        # 3. Bulunan her hedef için döngü başlatıyoruz
        for source in sources:
            print(f"Hedef saptandı: {source.base_url} (ID: {source.id})")
            
            try:
                # Zaten açık olan 'db' oturumunu ve hedefin 'id'sini fonksiyona gönderiyoruz
                scrape_basic_info(source.id)
                print(f"Başarılı: {source.base_url} tarandı ve veriler kaydedildi!")
            except Exception as e:
                print(f"Hata oluştu ({source.base_url}): {e}")
            
    finally:
        # 4. İşlem bitince veritabanı bağlantısını güvenle kapatıyoruz (Sistem şişmesin diye)
        db.close()
        print("OTOPİLOT: Görev tamamlandı, uyku moduna geçiliyor.\n")

def start_scheduler():
    scheduler.add_job(auto_crawl_task, 'interval', minutes=1, id='auto_crawl_job', replace_existing=True)
    scheduler.start()
    print("APScheduler başarıyla başlatıldı ve otopilot devrede!")