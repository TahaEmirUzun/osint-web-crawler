# 🛡️ OSINT Web Crawler for Security Advisories

Siber güvenlik zafiyetlerini (CVE), duyurularını ve yama notlarını onaylı açık kaynaklardan otomatik olarak toplayan, analiz eden ve raporlayan Python tabanlı bir OSINT (Open Source Intelligence) aracıdır. Sistem; UI, REST API ve Crawler Engine olarak tamamen yalıtılmış (decoupled) katmanlardan oluşmaktadır.

## 🎯 Projenin Amacı

Devlet kurumları, zafiyet veritabanları ve yazılım üreticileri tarafından **herkese açık** yayımlanan güvenlik duyurularını (security advisories, CVE kayıtları, yama notları) etik kurallara uygun şekilde toplamak, yapılandırılmış olarak saklamak ve bir web arayüzü üzerinden aranabilir/filtrelenebilir hale getirmek.

Sistem; sızdırılmış veri, kimlik bilgisi, özel kayıt, giriş gerektiren içerik veya gereksiz kişisel bilgi **toplamaz**.

## 🚀 Özellikler

- **Yalıtılmış Mimari:** Frontend, Backend ve Tarayıcı Motoru birbirinden tamamen bağımsız çalışır. İletişim sadece RESTful API üzerinden sağlanır.
- **Çoklu Ayrıştırıcı (Multi-Parser):** Ubuntu ve PostgreSQL için özel, diğer kaynaklar için genel ayrıştırıcı; CVE, kritiklik, kurum, ürün ve yayın tarihi alanlarını çıkarır.
- **Dinamik Etik Tarama:** `robots.txt` kurallarına (ve `Crawl-delay` değerine) uyar, tanımlayıcı bir User-Agent kullanır, kaynak bazlı gecikme ile istekleri sınırlar.
- **Güvenlik Odaklı (SSRF Koruması):** Hedef URL'ler ve her yönlendirme adımı taranmadan önce doğrulanır. `localhost`, özel IPv4/IPv6 blokları ve bulut meta veri adresleri engellenir.
- **Arka Plan Görevleri:** Taramalar API'yi bloklamadan arka planda çalışır; ilerleme, sayfa/kayıt/hata sayıları canlı takip edilir ve görev güvenle durdurulabilir.
- **Mükerrer Kayıt Kontrolü:** Aynı URL'e sahip duyuru tekrar eklenmez, mevcut kayıt güncellenir.

## 🏗️ Mimari Genel Bakış

```
Web UI (React)  --HTTP/JSON-->  REST API (FastAPI)  -->  Crawler Engine  -->  Database (SQLite)
```

Crawler motoru web arayüzüyle doğrudan konuşmaz; tüm iletişim REST API üzerinden yapılır. Ayrıntılı diyagramlar:

- [Mimari Diyagram](docs/architecture.md)
- [Veritabanı Diyagramı](docs/database.md)
- [API Dokümantasyonu ve Örnek İstek/Yanıtlar](docs/api.md)
- [Bulgular ve Kısıtlamalar Raporu](docs/report.md)
- [Örnek Toplanmış Veri Seti](docs/sample_dataset.json)
- [Ekran Görüntüleri](docs/screenshots/)

```
backend/
├── app/
│   ├── api/routes/     # health, sources, crawls, advisories, statistics, logs
│   ├── core/           # ortam değişkenleri, hata formatı, zaman yardımcıları
│   ├── database/       # bağlantı ve şema migrasyonları
│   ├── models/         # SQLAlchemy modelleri
│   ├── schemas/        # Pydantic doğrulama şemaları
│   ├── services/       # crawler motoru, görev yürütücü, SSRF kontrolü, kaynak yükleyici
│   └── scheduler.py    # periyodik otomatik tarama
├── config/sources.json # onaylı kaynak tanımları
└── tests/              # pytest testleri ve yerel HTML fixture'ları
frontend/
├── src/{api,components,layout,pages,utils}
└── tests/              # vitest testleri
```

## 🛠️ Teknik Mimari

- **Backend:** FastAPI, SQLAlchemy, Pydantic, Python 3.11
- **Crawler Engine:** BeautifulSoup4, Requests, urllib.robotparser
- **Arka Plan İşleri:** FastAPI BackgroundTasks + APScheduler (periyodik otomatik tarama)
- **Frontend:** React, TypeScript, Vite, Recharts, Lucide-React
- **Database:** SQLite (`DATABASE_URL` ile PostgreSQL'e geçişe hazır yapı)
- **Deployment:** Docker, Docker Compose
- **Testing:** Pytest & Vitest

## ⚙️ Ortam Değişkenleri (Environment Configuration)

Tüm değişkenlerin açıklamalı listesi [`backend/.env.example`](backend/.env.example) dosyasındadır. Kendi ayarlarınız için kopyalayın (gizli veriler asla Git'e yüklenmez, `.env` dosyası `.gitignore` içindedir):

```bash
cp backend/.env.example backend/.env
```

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `DATABASE_URL` | `sqlite:///../data/osint_crawler.db` | Veritabanı bağlantısı (Docker'da `/data` klasörü) |
| `LOG_DIR` | `../logs` | Dönen (rotating) log dosyalarının klasörü |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:5173` | CORS için izin verilen frontend adresleri |
| `MAX_REQUEST_BODY_BYTES` | `1048576` | API isteklerinin maksimum boyutu |
| `CRAWLER_USER_AGENT` | `OSINT-Advisory-Crawler/1.0 (...)` | Tarayıcının kendini tanıttığı User-Agent |
| `CRAWLER_TIMEOUT_SECONDS` | `15` | İstek zaman aşımı |
| `CRAWLER_MAX_RETRIES` | `3` | Geçici hatalarda (5xx, timeout) deneme sayısı |
| `CRAWLER_MAX_PAGES_LIMIT` | `500` | Bir taramada izin verilen maksimum sayfa |
| `CRAWLER_MAX_DEPTH_LIMIT` | `3` | İzin verilen maksimum tarama derinliği |
| `CRAWLER_MIN_DELAY_SECONDS` | `1` | İstekler arası minimum bekleme |
| `AUTO_CRAWL_INTERVAL_HOURS` | `12` | Otomatik tarama aralığı (`0` = kapalı) |
| `SEED_SOURCES_FILE` | `config/sources.json` | Kaynak tablosu boşken yüklenecek onaylı kaynaklar |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Frontend'in bağlandığı API adresi |

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

3. **Erişim Noktaları (Portlar):**
   - **Frontend Web UI:** http://localhost:3000
   - **Backend REST API:** http://localhost:8000
   - **API Dokümantasyonu (Swagger):** http://localhost:8000/docs
   - **OpenAPI Şeması:** http://localhost:8000/openapi.json

SQLite veritabanı `./data`, loglar `./logs` klasörüne kalıcı olarak yazılır. `backend/.env` dosyası yoksa varsayılan değerler kullanılır.

## 🐍 Backend Kurulumu (Docker olmadan)

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## ⚛️ Frontend Kurulumu (Docker olmadan)

```bash
cd frontend
npm install
npm run dev -- --port 3000
```

API farklı bir adreste çalışıyorsa `VITE_API_BASE_URL` değişkenini ayarlayın.

## 🗄️ Veritabanı ve Migrasyonlar

- Tablolar uygulama ilk açıldığında `init_db()` ile otomatik oluşturulur.
- Sonradan eklenen kolonlar (`advisories.last_updated`, `sources.maximum_pages`, `sources.last_crawl_status`, `sources.last_crawl_records`) mevcut veritabanlarına başlangıçta otomatik `ALTER TABLE` ile eklenir (`backend/app/database/connection.py` → `SCHEMA_MIGRATIONS`). Var olan veriler korunur.
- Yeni bir kolon eklerken modeli güncelleyip aynı kolonu `SCHEMA_MIGRATIONS` sözlüğüne eklemeniz yeterlidir.
- Kaynak tablosu boşsa [`backend/config/sources.json`](backend/config/sources.json) içindeki onaylı kaynaklar ilk açılışta yüklenir.

## 🎯 Nasıl Kullanılır? (How to Start a Crawl)

1. Web arayüzünde **Kaynaklar** sekmesine gidin. Hazır gelen onaylı kaynakları inceleyin veya yenilerini ekleyin. "Kontrol Et" butonu ile kaynağın `robots.txt` durumunu görebilirsiniz.
2. **Tarama İşleri** sayfasında **Yeni Tarama Başlat** butonuna tıklayın.
3. Kaynakları seçin; isterseniz anahtar kelime (Örn: `critical, rce`), başlangıç tarihi, maksimum sayfa ve tarama derinliği belirleyip taramayı başlatın.
4. Sistem bir **Job ID** üretecek ve taramayı arka planda başlatacaktır. **Detay** penceresinden ilerlemeyi, hata sayısını ve son logları canlı takip edebilir, gerekirse **Durdur** butonuyla taramayı sonlandırabilirsiniz.
5. Toplanan kayıtları **Zafiyetler** sayfasında arayabilir, filtreleyebilir, sıralayabilir ve CSV olarak dışa aktarabilirsiniz.

API üzerinden de başlatılabilir:

```bash
curl -X POST http://localhost:8000/api/crawls \
  -H "Content-Type: application/json" \
  -d '{"source_ids": [1, 2], "maximum_pages": 100, "date_from": "2026-01-01", "keywords": ["critical"]}'
```

## 🔗 API Uç Noktaları (Endpoints)

| Metot | Uç Nokta | Açıklama |
|---|---|---|
| `GET` | `/api/health` | Sistem ve veritabanı durumu |
| `GET` | `/api/sources` | Kayıtlı kaynakları listeler |
| `POST` | `/api/sources` | Yeni kaynak ekler |
| `PUT` | `/api/sources/{source_id}` | Kaynağı günceller |
| `PATCH` | `/api/sources/{source_id}/status` | Kaynağı aktif/pasif yapar |
| `GET` | `/api/sources/{source_id}/robots` | `robots.txt` izin durumunu kontrol eder |
| `GET` | `/api/sources/{source_id}/export` | Kaynağın kayıtlarını CSV olarak indirir |
| `POST` | `/api/crawls` | Tarama görevi başlatır (hemen `job_id` döner) |
| `GET` | `/api/crawls` | Tarama görevlerini listeler |
| `GET` | `/api/crawls/{job_id}` | Görev durumunu ve ilerlemesini getirir |
| `POST` | `/api/crawls/{job_id}/stop` | Çalışan görevi durdurur |
| `GET` | `/api/advisories` | Kayıtları filtreleme/sayfalama ile listeler |
| `GET` | `/api/advisories/{advisory_id}` | Kayıt detayını getirir |
| `DELETE` | `/api/advisories/{advisory_id}` | Kaydı siler |
| `GET` | `/api/statistics/summary` | Dashboard özet istatistikleri |
| `GET` | `/api/statistics/timeline` | Tarihe göre kayıt sayıları |
| `GET` | `/api/logs` | Logları seviye, görev, kaynak ve tarihe göre filtreler |

Tüm hatalar aynı formatta döner: `{"error": {"code": "SOURCE_NOT_FOUND", "message": "..."}}`. Ayrıntılar ve örnekler: [docs/api.md](docs/api.md).

## 🔐 Güvenlik Kontrolleri (Security Controls)

- **SSRF koruması:** `localhost`, `127.0.0.0/8`, `0.0.0.0`, özel IPv4 (10/8, 172.16/12, 192.168/16), özel/link-local IPv6 (`::1`, `fc00::/7`, `fe80::/10`), IPv4-mapped IPv6, bulut meta veri adresleri (`169.254.169.254` vb.) ve `.internal`, `.local`, `.corp` gibi iç servis alan adları engellenir. Domain'in çözümlendiği **tüm** IP adresleri kontrol edilir ve yönlendirmeler tek tek doğrulanır.
- **Girdi doğrulama:** Tüm istekler Pydantic şemalarıyla doğrulanır (URL formatı, gecikme ve sayfa sınırları, tarih formatı, anahtar kelime sayısı).
- **SQL injection:** Tüm sorgular SQLAlchemy ORM ile parametreli çalışır; sıralama alanları beyaz listeden seçilir.
- **XSS:** Toplanan içerik React tarafından düz metin olarak gösterilir; sadece `http/https` bağlantılar tıklanabilir ve `rel="noopener noreferrer"` ile yeni sekmede açılır. CSV dışa aktarımda formül enjeksiyonu engellenir.
- **Hata yönetimi:** Stack trace ve iç hata detayları kullanıcıya gönderilmez, sadece sunucu loglarına yazılır.
- **Sınırlar:** İstek gövdesi boyutu, tarama sayfa/derinlik sayısı, yanıt boyutu ve istek zaman aşımı sınırlıdır.
- **CORS:** Sadece `ALLOWED_ORIGINS` içindeki frontend adreslerine izin verilir.
- **Gizli bilgiler:** Konfigürasyon ortam değişkenlerinden okunur; `.env` dosyaları Git'e eklenmez.

## 🧭 Etik Önlemler (Ethical Safeguards)

- Sadece onaylı ve herkese açık güvenlik duyurusu kaynakları taranır; her kaynak eklenmeden önce incelenmelidir.
- `robots.txt` kurallarına ve `Crawl-delay` değerine uyulur; `robots.txt` okunamazsa ihtiyaten tarama yapılmaz.
- Tarayıcı kendini sahte tarayıcı kimliğiyle değil, iletişim adresi içeren tanımlayıcı bir User-Agent ile tanıtır.
- İstekler arası en az 1 saniye beklenir; aynı URL iki kez istenmez.
- Login, hesap, kayıt, ödeme gibi kısıtlı sayfalara gidilmez; şifre alanı içeren sayfalardan veri toplanmaz.
- 401/403/429 gibi erişim engeli yanıtları tekrar denenmez; tekrarlanan engellemede kaynak taraması durdurulur.
- CAPTCHA, paywall veya kimlik doğrulama atlatılmaya çalışılmaz; e-posta/telefon gibi kişisel veriler toplanmaz.

## 🧪 Test Talimatları (Testing)

Backend testleri izole bir geçici veritabanı ve `backend/tests/fixtures` içindeki yerel HTML dosyalarını kullanır; canlı sitelere istek atmaz ve gerçek veritabanınıza dokunmaz.

**Backend Testleri (Docker üzerinden):**
```bash
docker compose exec backend pytest -v
```

**Backend Testleri (yerel):**
```bash
cd backend
pytest -v
```

**Frontend Testleri (Vitest üzerinden):**
```bash
cd frontend
npx vitest run
```

Tüm testleri tek seferde çalıştırmak için `run_tests.bat` (Windows) veya `./run_tests.sh` (Linux/macOS) kullanılabilir.

Kapsanan senaryolar: health endpoint, kaynak oluşturma ve doğrulama, tarama görevi oluşturma/durum/durdurma, zafiyet filtreleme ve sayfalama, hata yanıtları, mükerrer kayıt kontrolü, URL güvenlik doğrulaması, iki kaynağa özel ayrıştırıcı, robots.txt/rate limit/retry davranışı, uçtan uca entegrasyon testi; frontend tarafında dashboard render, tarama formu doğrulaması, API hata yönetimi, yükleniyor durumu, zafiyet tablosu filtreleme ve tarama ilerleme gösterimi.

## ⚠️ Bilinen Kısıtlamalar (Known Limitations)

- **JavaScript Render Edilen Siteler:** Tarayıcı HTTP istekleri ile çalıştığı için SPA tabanlı sitelerin dinamik verilerini okumak için Playwright/Selenium gereklidir.
- **Erişim Korumaları:** Etik kurallar gereği Login ekranları veya CAPTCHA korumaları aşılmaya çalışılmaz.
- **Kimlik Doğrulama:** İlk sürümde kullanıcı girişi yoktur; silme ve kaynak yönetimi işlemleri herkese açıktır. Uygulama sadece yerel/güvenilir ağda çalıştırılmalıdır.
- **Görev Kuyruğu:** Görevler FastAPI BackgroundTasks ile aynı süreç içinde çalışır; sunucu yeniden başlatılırsa yarıda kalan görevler `failed` olarak işaretlenir.
- **Alan Çıkarımı:** Kritiklik ve yayın tarihi regex/meta etiketleriyle çıkarıldığı için kaynak sayfada açıkça yazmıyorsa `Unknown` veya boş kalabilir.
  
## Lisans

Bu projenin kaynak kodu [MIT Lisansı](LICENSE) ile lisanslanmıştır © 2026 Taha Emir Uzun.

`docs/Build a Python-Based OSINT Web Crawler.docx` dosyası staj kapsamında verilen görev tanımıdır; bu lisansın kapsamında değildir.
