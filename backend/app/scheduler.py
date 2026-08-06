from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime

# Arka planda çalışacak zamanlayıcımızı oluşturuyoruz
scheduler = BackgroundScheduler()

def auto_crawl_task():
    """
    Otopilotun her tetiklendiğinde yapacağı iş.
    Şimdilik sistemin çalıştığını görmek için sadece terminale yazı yazdırıyoruz.
    Gerçek tarama (crawler) fonksiyonunu bir sonraki adımda buraya bağlayacağız.
    """
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] OTOPİLOT AKTİF: Kaynaklar taranıyor...")

def start_scheduler():
    """
    Zamanlayıcıyı başlatan ana fonksiyon.
    """
    # Test edebilmemiz için şimdilik 'her 1 dakikada bir' çalışacak şekilde ayarlıyoruz.
    # Gerçek canlı ortamda bunu hours=1 veya minutes=30 yapabiliriz.
    scheduler.add_job(auto_crawl_task, 'interval', minutes=1, id='auto_crawl_job', replace_existing=True)
    
    scheduler.start()
    print("APScheduler başarıyla başlatıldı ve otopilot devrede!")