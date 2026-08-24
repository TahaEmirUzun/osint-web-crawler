# 🛡️ OSINT Security Advisory Crawler

Siber güvenlik zafiyetlerini ve duyurularını otomatik olarak toplayan, analiz eden ve raporlayan Python tabanlı bir OSINT (Open Source Intelligence) aracıdır.

## 🚀 Özellikler

- **Akıllı Tarama:** Rekürsif (derinlemesine) tarama yeteneği ve sayfa derinliği kontrolü.
- **Güvenlik Odaklı:** SSRF (Server-Side Request Forgery) koruması ile iç ağ erişimleri engellenmiştir.
- **Etik Tarama:** `robots.txt` kontrolü ve Anti-Bot bypass için rastgele gecikmeler ve User-Agent rotasyonu.
- **Siber Güvenlik Analizi:** Regex tabanlı CVE ayıklama ve zafiyet kritiklik seviyesi (Severity) tespiti.
- **Otomasyon:** APScheduler ile periyodik otomatik tarama (Otopilot).
- **Modern Arayüz:** React + TypeScript tabanlı, istatistik paneli ve log yönetim ekranı.

## 🛠️ Teknik Mimari

- **Backend:** FastAPI, SQLAlchemy, SQLite
- **Crawler:** BeautifulSoup4, Requests
- **Frontend:** React, Vite, Recharts, Lucide-React
- **Deployment:** Docker, Docker Compose

## 📦 Kurulum ve Çalıştırma

### Gereksinimler
- Docker ve Docker Compose

### Adımlar
1. Proje klasörüne gidin:
   ```bash
   cd osint-web-crawler
