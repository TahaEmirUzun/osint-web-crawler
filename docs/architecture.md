# System Architecture

Bu diyagram, OSINT Web Crawler projesinin katmanlı mimarisini ve veri akışını göstermektedir. Sistem, ön yüz ve tarayıcı motoru arasındaki iletişimin sadece REST API üzerinden yapıldığı tam yalıtımlı bir yapıda tasarlanmıştır.

```mermaid
graph TD
    User([Kullanıcı]) <-->|Etkileşim| UI[Web UI<br/>React + TypeScript]
    UI <-->|HTTP / JSON<br/>polling| API[REST API Backend<br/>FastAPI + Pydantic]
    API <-->|Okuma / Yazma| DB[(Database & Storage<br/>SQLite)]
    
    API -->|Arka Plan Görevi Tetikler| TaskQueue[Background Job<br/>BackgroundTasks / APScheduler]
    TaskQueue -->|crawl_runner| Crawler[Crawler Engine<br/>Requests + BeautifulSoup4]
    Crawler -->|URL / Yönlendirme Kontrolü| SSRF[SSRF Guard<br/>security.py]
    Crawler -->|Kurallar| Robots[robots.txt + Rate Limiter]
    
    Crawler -->|Çekilen Veri ve Logları Kaydeder| DB
    Crawler <-->|HTTP GET| Targets((Approved Public<br/>Internet Sources))

    classDef frontend fill:#3b82f6,stroke:#1e40af,color:#fff;
    classDef backend fill:#10b981,stroke:#047857,color:#fff;
    classDef crawler fill:#f59e0b,stroke:#b45309,color:#fff;
    classDef db fill:#6366f1,stroke:#4338ca,color:#fff;
    
    class UI frontend;
    class API backend;
    class Crawler,TaskQueue,SSRF,Robots crawler;
    class DB db;
```

## Tarama Akışı

1. Kullanıcı arayüzden kaynakları seçip taramayı başlatır → `POST /api/crawls`.
2. API isteği Pydantic ile doğrular, `crawl_jobs` tablosuna `queued` durumunda bir kayıt açar ve hemen `job_id` döner.
3. `crawl_runner.run_crawl_job` arka planda her kaynak için `CrawlerEngine` çalıştırır:
   - URL ve her yönlendirme SSRF kontrolünden geçer,
   - `robots.txt` bir kez indirilip önbelleğe alınır, kurallara ve `Crawl-delay` değerine uyulur,
   - istekler arası kaynak bazlı gecikme uygulanır, 5xx/timeout hataları sınırlı sayıda tekrar denenir, 401/403/429 tekrar denenmez,
   - sayfalar domaine uygun ayrıştırıcı ile işlenir, aynı URL tekrar ziyaret edilmez.
4. İlerleme (`progress`, `pages_visited`, `records_extracted`, `error_count`) her sayfadan sonra veritabanına yazılır; arayüz bunu `GET /api/crawls/{job_id}` ile periyodik olarak okur.
5. `POST /api/crawls/{job_id}/stop` görevi `stopping` durumuna alır; motor bir sonraki sayfadan önce bunu görüp `stopped` olarak sonlanır.
6. Toplanan kayıtlar `advisories` tablosuna yazılır (aynı URL varsa güncellenir), loglar `crawl_logs` tablosuna ve `logs/system.log` dosyasına düşer.
