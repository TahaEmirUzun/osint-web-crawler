from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
from app.database.connection import SessionLocal 
from app.models.source import Source 
from app.services.crawler import scrape_basic_info
from app.models.advisory import Advisory
from app.models.crawl_job import CrawlJob
from app.models.crawl_log import CrawlLog

scheduler = BackgroundScheduler()

def auto_crawl_task():
    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] OTOPİLOT AKTİF: Veritabanı kontrol ediliyor...")
    
    db = SessionLocal()
    try:
        # Sadece aktif (enabled=True) olan kaynakları tara
        sources = db.query(Source).filter(Source.enabled == True).all()
        
        if not sources:
            print("Veritabanında taranacak aktif hedef bulunamadı.")
            return
            
        for source in sources:
            print(f"Hedef saptandı: {source.base_url} (ID: {source.id})")
            
            # --- 1. YENİ: TARAMA GÖREVİ (JOB) OLUŞTURMA ---
            # Dokümanda istenen Job ID formatı (Örn: crawl_20260721_001)
            job_id = f"crawl_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{source.id}"
            
            yeni_job = CrawlJob(
                id=job_id,
                status="running",
                started_date=datetime.now()
            )
            db.add(yeni_job)
            db.commit() # Job'ı veritabanına hemen yazıyoruz ki arayüzden "çalışıyor" olarak görülsün
            
            try:
                scraped_data_list = scrape_basic_info(source.base_url)
                
                if scraped_data_list:
                    print(f"Toplam {len(scraped_data_list)} sayfa başarıyla tarandı. Veritabanına yazılıyor...")
                    
                    kayit_sayisi = 0
                    for data in scraped_data_list:
                        
                        # --- ZIRH KODLARI BURADA KORUNDU ---
                        if isinstance(data, list) and len(data) > 0:
                            data = data[0]
                        
                        if not isinstance(data, dict):
                            continue
                        # -----------------------------------
                        
                        # 2. Mükerrer Kayıt Kontrolü (Artık eski CrawledData yerine Advisory tablosunda arıyoruz)
                        mevcut_kayit = db.query(Advisory).filter(Advisory.url == data.get("url")).first()
                        
                        if not mevcut_kayit:
                            # 3. YENİ: Eski gereksiz verileri (email, telefon) attık, Siber Güvenlik şemasına bağladık
                            yeni_kayit = Advisory(
                                title=data.get("title", "Başlık Bulunamadı"),
                                url=data.get("url"),
                                summary=data.get("description", ""),
                                source_domain=source.base_url,
                                crawl_job_id=job_id
                            )
                            
                            db.add(yeni_kayit)
                            kayit_sayisi += 1
                            print(f"📥 YENİ KAYIT EKLENDİ: {data.get('url')}")
                        else:
                            print(f"🔄 ZATEN MEVCUT (Geçiliyor): {data.get('url')}")
                    
                    # 4. YENİ: Görev (Job) Başarıyla Bittiğinde Durumunu Güncelle
                    yeni_job.status = "completed"
                    yeni_job.completed_date = datetime.now()
                    yeni_job.records_extracted = kayit_sayisi
                    yeni_job.pages_visited = len(scraped_data_list)
                    
                    # Kaynağın (Source) son taranma tarihini güncelle
                    source.last_crawl_date = datetime.now()
                    
                    db.commit()
                    print(f"🎉 Tüm alt sayfalar dahil {source.base_url} hedefinin taraması ve kaydı bitti!")
                    
            except Exception as e:
                print(f"Hata oluştu ({source.base_url}): {e}")
                
                # 5. YENİ: Hata durumunda Job'ı failed olarak işaretle ve Log tablosuna yaz
                yeni_job.status = "failed"
                yeni_job.error_count += 1
                yeni_job.completed_date = datetime.now()
                
                hata_log = CrawlLog(
                    crawl_job_id=job_id, 
                    log_level="ERROR", 
                    message=str(e), 
                    source=source.base_url
                )
                db.add(hata_log)
                db.commit()
            
    finally:
        db.close()
        print("OTOPİLOT: Görev tamamlandı, uyku moduna geçiliyor.\n")

def start_scheduler():
    scheduler.add_job(auto_crawl_task, 'interval', hours=12, id='auto_crawl_job', replace_existing=True)
    scheduler.start()
    print("APScheduler başarıyla başlatıldı ve otopilot devrede!")