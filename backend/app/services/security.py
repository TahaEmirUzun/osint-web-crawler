import socket
import ipaddress
import logging
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

ALLOWED_SCHEMES = {"http", "https"}

# İç servisleri ve bulut meta veri uçlarını işaret eden host adları
BLOCKED_HOSTNAMES = {
    "localhost",
    "metadata",
    "metadata.google.internal",
    "metadata.azure.com",
    "instance-data",
    "instance-data.ec2.internal",
}
BLOCKED_HOST_SUFFIXES = (".localhost", ".local", ".localdomain", ".internal", ".intranet", ".lan", ".corp", ".home.arpa")

# Bazı sağlayıcıların meta veri adresleri özel/link-local bloklarının dışında kalabiliyor
CLOUD_METADATA_IPS = {
    ipaddress.ip_address("169.254.169.254"),
    ipaddress.ip_address("169.254.170.2"),
    ipaddress.ip_address("100.100.100.200"),
    ipaddress.ip_address("fd00:ec2::254"),
}


def is_blocked_ip(ip: ipaddress._BaseAddress) -> bool:
    """Localhost, özel ağ, link-local, multicast, rezerve ve meta veri adreslerini engeller."""
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return (
        ip in CLOUD_METADATA_IPS
        or ip.is_loopback
        or ip.is_private
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
        or not ip.is_global
    )


def get_url_rejection_reason(url: str, resolve: bool = True):
    """URL güvenliyse None, değilse engellenme sebebini döndürür."""
    try:
        parsed = urlparse(url)
    except ValueError:
        return "URL formatı geçersiz."

    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        return "Sadece http ve https adresleri taranabilir."

    hostname = parsed.hostname
    if not hostname:
        return "URL içinde geçerli bir host adı bulunamadı."

    if parsed.username or parsed.password:
        return "Kullanıcı bilgisi içeren URL'lere izin verilmez."

    try:
        parsed.port
    except ValueError:
        return "URL içindeki port numarası geçersiz."

    host = hostname.lower().rstrip(".")
    if host in BLOCKED_HOSTNAMES or host.endswith(BLOCKED_HOST_SUFFIXES):
        return "İç ağ veya meta veri servisine ait host adı engellendi."

    try:
        literal_ip = ipaddress.ip_address(host)
    except ValueError:
        literal_ip = None

    if literal_ip is not None:
        return "İç ağa ait IP adresi engellendi." if is_blocked_ip(literal_ip) else None

    if not resolve:
        return None

    # DNS çözümlemesi: domain'in işaret ettiği TÜM IPv4/IPv6 adresleri kontrol edilir
    try:
        address_infos = socket.getaddrinfo(host, parsed.port or None, proto=socket.IPPROTO_TCP)
    except (socket.gaierror, UnicodeError):
        return "Domain çözümlenemedi."

    if not address_infos:
        return "Domain çözümlenemedi."

    for info in address_infos:
        ip_string = info[4][0].split("%")[0]
        try:
            resolved_ip = ipaddress.ip_address(ip_string)
        except ValueError:
            return "Domain geçersiz bir IP adresine çözümlendi."
        if is_blocked_ip(resolved_ip):
            return f"Domain iç ağa ait bir adrese çözümlendi ({ip_string})."

    return None


def is_safe_url(url: str, resolve: bool = True) -> bool:
    """
    Verilen URL'in SSRF saldırılarına karşı güvenli olup olmadığını kontrol eder.
    Localhost, özel (private) IPv4/IPv6 ağları ve bulut meta veri adreslerini engeller.
    """
    reason = get_url_rejection_reason(url, resolve=resolve)
    if reason:
        logger.warning("GÜVENLİK: URL engellendi (%s): %s", url, reason)
        return False
    return True
