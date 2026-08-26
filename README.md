# 🛡️ OSINT Web Crawler for Security Advisories

Siber güvenlik zafiyetlerini (CVE), duyurularını ve yama notlarını onaylı açık kaynaklardan otomatik olarak toplayan, analiz eden ve raporlayan Python tabanlı bir OSINT (Open Source Intelligence) aracıdır. Sistem; UI, REST API ve Crawler Engine olarak tamamen yalıtılmış (decoupled) katmanlardan oluşmaktadır.

## 🚀 Özellikler

- **Yalıtılmış Mimari:** Frontend, Backend ve Tarayıcı Motoru birbirinden tamamen bağımsız çalışır. İletişim sadece RESTful API üzerinden sağlanır.
- **Çoklu Ayrıştırıcı (Multi-Parser):** Her kaynağa özel dinamik ayrıştırma algoritmaları ile yüksek veri doğruluğu sağlar.
- **Dinamik Etik Tarama:** Hedef sitelerin `robots.txt` kurallarına uyar ve veritabanından gelen dinamik gecikme süreleriyle (Dynamic Rate Limiting) sunucuları yormaz.
- **Güvenlik Odaklı (SSRF Koruması):** Hedef URL'ler taranmadan önce doğrulanır. İç ağa (`localhost`, `127.0.0.1`, özel IP blokları) yönelik SSRF saldırıları engellenir.
- **Arka Plan Görevleri:** Taramalar, API'yi bloklamadan arka planda asenkron olarak çalışır ve canlı ilerleme takibi sunar.

## 🛠️ Teknik Mimari

- **Backend:** FastAPI, SQLAlchemy, Pydantic, Python 3.11
- **Crawler Engine:** BeautifulSoup4, Requests, urllib.robotparser
- **Frontend:** React, TypeScript, Vite, Lucide-React
- **Database:** SQLite (PostgreSQL'e geçişe hazır yapı)
- **Deployment:** Docker, Docker Compose
- **Testing:** Pytest & Vitest (Full coverage)

## ⚙️ Ortam Değişkenleri (Environment Configuration)

Proje dizininde `backend` klasörü içine bir `.env` dosyası oluşturun ve aşağıdaki değişkenleri ekleyin (Gizli veriler asla Git'e yüklenmez):

```env
DATABASE_URL=sqlite:////data/osint_crawler.db
LOG_DIR=/logs
```

## 📦 Kurulum ve Çalıştırma (Docker)

Tüm sistem tek bir komutla ayağa kalkacak şekilde tam kapsamlı konteynerize edilmiştir.
    
1. Proje klasörüne gidin:
```bash
cd osint-web-crawler
```
    
2. Docker Compose ile tüm sistemi (Frontend + Backend + Database) başlatın:
```bash
docker compose up --build -d
```

3. **Erişim Noktaları:**
   - **Frontend Web UI:** http://localhost:3000
   - **Backend REST API:** http://localhost:8000
   - **API Dokümantasyonu (Swagger):** http://localhost:8000/docs

## 🎯 Nasıl Kullanılır? (How to Start a Crawl)

1. Web arayüzünde **Kaynaklar** sekmesine gidin ve taranmasını istediğiniz onaylı URL'leri ekleyin.
2. **Tarama İşleri** sayfasına geçin.
3. Eklediğiniz kaynakları seçin, isterseniz aranacak kelimeleri (Örn: "CVE", "Critical") belirleyin ve taramayı başlatın.
4. Sistem bir **Job ID** üretecek ve taramayı arka planda başlatacaktır. İlerlemeyi canlı olarak arayüzden takip edebilirsiniz.

## 🔗 API Uç Noktaları (Endpoints)

- `GET /api/health` : Sistem durumunu kontrol eder.
- `GET /api/sources` : Kayıtlı kaynakları listeler.
- `POST /api/sources` : Yeni bir tarama kaynağı ekler.
- `POST /api/crawls` : Yeni bir tarama görevi başlatır.
- `GET /api/crawls/{job_id}` : Görev ilerlemesini getirir.
- `POST /api/crawls/{job_id}/stop` : Çalışan bir taramayı güvenle durdurur.
- `GET /api/advisories` : Toplanan zafiyetleri listeler.

## 🧪 Test Talimatları (Testing)

Sistem hem backend hem de frontend için test senaryolarına sahiptir:

**Backend Testleri (Docker üzerinden):**
```bash
docker compose exec backend pytest test_api.py -v
```

## ⚠️ Bilinen Kısıtlamalar (Known Limitations)

- **JavaScript Render Edilen Siteler:** Tarayıcı HTTP istekleri ile çalıştığı için SPA tabanlı sitelerin dinamik verilerini okumak için Playwright/Selenium gereklidir.
- **Erişim Korumaları:** Etik kurallar gereği Login ekranları veya CAPTCHA korumaları aşılmaya çalışılmaz.