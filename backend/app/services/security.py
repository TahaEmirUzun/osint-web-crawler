import socket
import ipaddress
from urllib.parse import urlparse

def is_safe_url(url: str) -> bool:
    """
    Verilen URL'in SSRF saldırılarına karşı güvenli olup olmadığını kontrol eder.
    Localhost, özel (private) ağlar ve bulut meta veri adreslerini engeller.
    """
    try:
        # 1. URL'den domain'i (veya IP'yi) ayıkla
        parsed = urlparse(url)
        hostname = parsed.hostname
        
        if not hostname:
            return False
            
        # 2. Domain'i IP adresine çevir (DNS Çözümleme)
        # Eğer kullanıcı direkt IP girdiyse de çalışır
        ip_string = socket.gethostbyname(hostname)
        ip = ipaddress.ip_address(ip_string)
        
        # 3. Tehlikeli IP bloklarını kontrol et
        # is_loopback: 127.0.0.1 (localhost)
        # is_private: 192.168.x.x, 10.x.x.x gibi ağlar
        # is_link_local: 169.254.x.x (AWS/GCP cloud metadata sızdırma adresleri)
        if ip.is_loopback or ip.is_private or ip.is_link_local:
            print(f"🚨 GÜVENLİK UYARISI: İç ağa erişim denemesi engellendi! ({url} -> {ip_string})")
            return False
            
        return True
        
    except socket.gaierror:
        # Geçersiz domain (DNS'te bulunamadı)
        print(f"⚠️ HATA: Geçersiz veya çözümlenemeyen domain ({url})")
        return False
    except ValueError:
        # Geçersiz IP formatı
        print(f"⚠️ HATA: Geçersiz IP formatı ({url})")
        return False
    except Exception as e:
        print(f"⚠️ HATA: URL kontrolünde beklenmeyen durum: {e}")
        return False