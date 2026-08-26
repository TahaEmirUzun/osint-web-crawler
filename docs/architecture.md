# System Architecture

Bu diyagram, OSINT Web Crawler projesinin katmanlı mimarisini ve veri akışını göstermektedir. Sistem, ön yüz ve tarayıcı motoru arasındaki iletişimin sadece REST API üzerinden yapıldığı tam yalıtımlı bir yapıda tasarlanmıştır.

```mermaid
graph TD
    User([Kullanıcı]) <-->|Etkileşim| UI[Web UI<br/>React + TypeScript]
    UI <-->|HTTP / JSON| API[REST API Backend<br/>FastAPI]
    API <-->|Okuma / Yazma| DB[(Database & Storage<br/>SQLite)]
    
    API -->|Arka Plan Görevi Tetikler| TaskQueue[Background Job<br/>APScheduler / BackgroundTasks]
    TaskQueue -->|Çalıştırır| Crawler[Crawler Engine<br/>Python / BeautifulSoup4]
    
    Crawler -->|Çekilen Veri ve Logları Kaydeder| DB
    Crawler <-->|HTTP GET / Rate Limiting| Targets((Approved Public<br/>Internet Sources))

    classDef frontend fill:#3b82f6,stroke:#1e40af,color:#fff;
    classDef backend fill:#10b981,stroke:#047857,color:#fff;
    classDef crawler fill:#f59e0b,stroke:#b45309,color:#fff;
    classDef db fill:#6366f1,stroke:#4338ca,color:#fff;
    
    class UI frontend;
    class API backend;
    class Crawler,TaskQueue crawler;
    class DB db;
 ```
 