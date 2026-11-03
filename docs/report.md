# OSINT Web Crawler: Findings and Limitations Report

## 1. Executive Summary
Bu proje kapsamında, herkese açık siber güvenlik kaynaklarından otonom bir şekilde veri toplayan, bu verileri yapılandırarak saklayan ve modern bir web arayüzü ile sunan tam kapsamlı bir OSINT (Açık Kaynak İstihbaratı) aracı geliştirilmiştir. Sistem; Docker üzerinde `3000` ve `8000` portlarında, Frontend, REST API ve Crawler Engine olarak tamamen yalıtılmış katmanlar halinde çalışmaktadır.

## 2. Key Findings (Temel Bulgular)
*   **Toplanan Veri:** Ubuntu, PostgreSQL, Arch Linux, cURL, Ruby, Debian, Apache ve Nginx gibi onaylı kaynaklardan **197** güvenlik duyurusu toplanmıştır (11 Kritik, 49 Yüksek, 117 Orta, 20 Düşük). Örnek veri seti: `docs/sample_dataset.json`.
*   **Çoklu Ayrıştırıcı (Multi-Parser) Mimarisi:** Ubuntu ve PostgreSQL için özel, diğer kaynaklar için genel ayrıştırıcı kullanılmaktadır. Kritiklik değeri sayfadaki ilk kelimeden değil, öncelikle `Severity/Priority/Impact` etiketlerinden ve CVSS skorundan çıkarılarak yanlış sınıflandırma azaltılmıştır.
*   **Güvenlik (SSRF Koruması):** Kaynak URL'leri ve tüm yönlendirme adımları taranmadan önce doğrulanmakta; `localhost`, özel IPv4/IPv6 ağları, bulut meta veri adresleri ve iç servis alan adlarına yönelik Server-Side Request Forgery (SSRF) denemeleri engellenmektedir.
*   **Dinamik Etik Tarama:** `robots.txt` kuralları domain başına önbelleğe alınarak uygulanmakta, tarayıcı kendini tanımlayıcı bir User-Agent ile tanıtmakta ve kaynak bazlı gecikme (rate limiting) ile hedef sunucular yorulmamaktadır. 403/429 gibi erişim engellerinde tarama tekrar denenmeden durdurulmaktadır.
*   **Görev Yönetimi:** Tarama görevleri API'yi bloklamadan arka planda çalışmakta, ilerleme sayfa bazında kaydedilmekte ve kullanıcı tarafından güvenle durdurulabilmektedir. Bir kaynağın başarısız olması diğer kaynakların taranmasını engellememektedir.
*   **Test Kapsamı:** Backend testleri geçici bir veritabanı ve yerel HTML fixture'ları üzerinde çalışmakta; canlı sitelere istek atmadan API, crawler, SSRF koruması ve uçtan uca tarama akışını doğrulamaktadır. Frontend testleri bileşenleri sahte API yanıtlarıyla test etmektedir.

## 3. Technical Limitations (Teknik Kısıtlamalar)
Sistemin mevcut sürümünde karşılaşılan temel mimari ve teknolojik kısıtlamalar şunlardır:
*   **JavaScript Render Edilen Sayfalar:** Tarayıcı motoru HTTP istekleri ve HTML ayrıştırma mantığıyla çalıştığından, Client-Side Rendering (CSR) kullanan sitelerin dinamik içerikleri okunamamaktadır (örn. Cisco güvenlik portalı).
*   **Erişim Engelleri:** Etik kurallar gereği kimlik doğrulama (authentication) veya CAPTCHA koruması arkasında bulunan veri setlerine erişim sağlanamamaktadır.
*   **Alan Çıkarımı:** Kritiklik ve yayın tarihi gibi alanlar regex ve meta etiketleriyle çıkarılmaktadır; kaynak sayfada açıkça yazmıyorsa `Unknown` veya boş kalabilir. Liste sayfaları da güvenlik anahtar kelimesi içerdiği için kayıt olarak saklanabilmektedir.
*   **Tek Süreçli Görev Kuyruğu:** Görevler API ile aynı süreçte çalışır. Sunucu yeniden başlarsa yarıda kalan görevler `failed` olarak işaretlenir ve yeniden başlatılmaları gerekir.
*   **Kimlik Doğrulama Yok:** İlk sürümde silme ve kaynak yönetimi işlemleri yetkilendirme gerektirmemektedir.

## 4. Recommended Future Improvements (Gelecek Geliştirmeler)
Projenin ölçeklenebilirliğini artırmak amacıyla önerilen iyileştirmeler şunlardır:
*   **Headless Browser Entegrasyonu:** Dinamik web sayfalarındaki zafiyet duyurularını toplayabilmek için sisteme `Playwright` veya `Selenium` entegre edilmelidir.
*   **Resmi Veri Kaynakları:** HTML ayrıştırma yerine NVD API, OSV veya üreticilerin RSS/CSAF/JSON beslemeleri kullanılarak alan doğruluğu artırılmalıdır.
*   **Dağıtık Görev Kuyruğu (Distributed Job Queue):** Üretim ortamında artan yükü kaldırabilmek için `Celery` ve `Redis` kullanılarak yatayda ölçeklenebilir bir mimariye geçilmelidir.
*   **WebSockets ile Canlı İletişim:** Görev durumunu izlemek için kullanılan HTTP Polling mekanizması, sunucu kaynaklarını optimize etmek adına WebSockets veya Server-Sent Events ile değiştirilmelidir.
*   **Kimlik Doğrulama ve Roller:** JWT tabanlı giriş, admin/viewer rolleri ve korumalı silme/kaynak yönetimi uçları eklenmelidir.
*   **Alembic Migrasyonları:** PostgreSQL'e geçişle birlikte hafif migrasyon mekanizması Alembic ile değiştirilmelidir.
