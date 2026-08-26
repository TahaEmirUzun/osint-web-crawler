# OSINT Web Crawler: Findings and Limitations Report

## 1. Executive Summary
Bu proje kapsamında, herkese açık siber güvenlik kaynaklarından otonom bir şekilde veri toplayan, bu verileri yapılandırarak saklayan ve modern bir web arayüzü ile sunan tam kapsamlı bir OSINT (Açık Kaynak İstihbaratı) aracı geliştirilmiştir. Sistem; Docker üzerinde `3000` ve `8000` portlarında, Frontend, REST API ve Crawler Engine olarak tamamen yalıtılmış katmanlar halinde çalışmaktadır.

## 2. Key Findings (Temel Bulgular)
*   **Çoklu Ayrıştırıcı (Multi-Parser) Mimarisi:** Sistem, tek tip bir tarayıcı yerine, farklı hedef sitelerin HTML yapılarına göre (Örn: Ubuntu Security Notices vs. Cisco Security) dinamik olarak devreye giren özel ayrıştırıcılar (parsers) barındıracak şekilde tasarlanmıştır. Bu sayede veri doğruluğu maksimize edilmiştir.
*   **Güvenlik (SSRF Koruması):** Sisteme dâhil edilen kaynak URL'leri taranmadan önce güvenlik süzgecinden geçirilmiş, `localhost`, `127.0.0.1` veya yerel ağ IP'lerine yönelik Server-Side Request Forgery (SSRF) saldırıları başarılı bir şekilde engellenmiştir.
*   **Dinamik Etik Tarama:** Uygulama, `urllib.robotparser` ile `robots.txt` kurallarına uymanın yanı sıra, tarama (rate limiting) gecikmelerini sabit bir değer yerine veritabanındaki `request_delay` sütunundan dinamik olarak çekerek hedef sunuculara saygılı bir yaklaşım sergilemektedir.
*   **Tam Kapsamlı Test Kapsamı:** Projenin sağlamlığını doğrulamak adına API sağlık durumu, crawler güvenliği ve frontend (kullanıcı arayüzü) doğrulamaları için uçtan uca otomatik testler yazılmıştır.

## 3. Technical Limitations (Teknik Kısıtlamalar)
Sistemin mevcut sürümünde (v1.0) karşılaşılan temel mimari ve teknolojik kısıtlamalar şunlardır:
*   **JavaScript Render Edilen Sayfalar:** Tarayıcı motoru temel olarak HTTP istekleri ve HTML ayrıştırma mantığıyla çalıştığından, Client-Side Rendering (CSR) kullanan sitelerin dinamik içerikleri okunamamaktadır.
*   **Erişim Engelleri:** Etik kurallar gereği kimlik doğrulama (authentication) veya CAPTCHA koruması arkasında bulunan özel veri setlerine erişim sağlanamamaktadır.

## 4. Recommended Future Improvements (Gelecek Geliştirmeler)
Projenin ölçeklenebilirliğini artırmak amacıyla önerilen iyileştirmeler şunlardır:
*   **Headless Browser Entegrasyonu:** Dinamik web sayfalarındaki zafiyet duyurularını toplayabilmek için sisteme `Playwright` veya `Selenium` entegre edilmelidir.
*   **Dağıtık Görev Kuyruğu (Distributed Job Queue):** Üretim ortamında artan yükü kaldırabilmek için `Celery` ve `Redis` kullanılarak yatayda ölçeklenebilir bir mimariye geçilmelidir.
*   **WebSockets ile Canlı İletişim:** Görev durumunu izlemek için kullanılan HTTP Polling mekanizması, sunucu kaynaklarını optimize etmek adına WebSockets mimarisi ile değiştirilmelidir.