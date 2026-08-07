from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
from app.database.connection import SessionLocal 
from app.models.source import Source 
from app.services.crawler import scrape_basic_info
from app.models.crawled_data import CrawledData 

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

                scraped_data_list = scrape_basic_info(source.base_url)
                
                # Eğer liste boş değilse (veri geldiyse)
                if scraped_data_list:
                    print(f"Toplam {len(scraped_data_list)} sayfa başarıyla tarandı. Veritabanına yazılıyor...")
                    
                    for data in scraped_data_list:
                        
                        # 1. Mükerrer Kayıt Kontrolü
                        mevcut_kayit = db.query(CrawledData).filter(CrawledData.url == data.get("url")).first()
                        
                        if not mevcut_kayit:
                            # 2. Liste olan verileri metne (string) çeviriyoruz
                            emails_str = ", ".join(data.get("emails", []))
                            phones_str = ", ".join(data.get("phones", []))
                            links_str = ", ".join(data.get("links", []))
                            
                            # 3. Yeni veritabanı satırını oluşturuyoruz
                            yeni_kayit = CrawledData(
                                source_id=source.id,
                                url=data.get("url"),
                                title=data.get("title"),
                                description=data.get("description"),
                                emails=emails_str,
                                phones=phones_str,
                                links=links_str
                            )
                            
                            # 4. Kaydı veritabanı oturumuna ekliyoruz
                            db.add(yeni_kayit)
                            print(f"📥 YENİ KAYIT EKLENDİ: {data.get('url')}")
                        else:
                            print(f"🔄 ZATEN MEVCUT (Geçiliyor): {data.get('url')}")
                    
                    # 5. Tüm döngü bittikten sonra eklenen verileri kalıcı olarak kaydediyoruz (Commit)
                    db.commit()
                    print(f"🎉 Tüm alt sayfalar dahil {source.base_url} hedefinin taraması ve kaydı bitti!")
                    
            except Exception as e:
                # EKSİK OLAN EXCEPT BLOĞU EKLENDİ
                print(f"Hata oluştu ({source.base_url}): {e}")
            
    finally:
        # 4. İşlem bitince veritabanı bağlantısını güvenle kapatıyoruz
        db.close()
        print("OTOPİLOT: Görev tamamlandı, uyku moduna geçiliyor.\n")

def start_scheduler():
    scheduler.add_job(auto_crawl_task, 'interval', minutes=1, id='auto_crawl_job', replace_existing=True)
    scheduler.start()
    print("APScheduler başarıyla başlatıldı ve otopilot devrede!")