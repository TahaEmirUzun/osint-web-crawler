import pytest

from app.services.security import is_safe_url


@pytest.mark.parametrize("url", [
    "http://localhost:8000/data",
    "http://127.0.0.1/admin",
    "http://127.1.2.3/",
    "http://0.0.0.0/",
    "http://10.0.0.5/",
    "http://172.16.0.1/",
    "http://192.168.1.1/private",
    "http://169.254.169.254/latest/meta-data/",
    "http://100.100.100.200/",
    "http://[::1]/",
    "http://[fd00::1]/",
    "http://[fe80::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://metadata.google.internal/computeMetadata/v1/",
    "http://intranet.corp/",
    "http://printer.local/",
])
def test_internal_addresses_are_blocked(url, fake_dns):
    assert is_safe_url(url) is False


@pytest.mark.parametrize("url", [
    "ftp://example.com/file",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "https://user:pass@example.com/",
    "https:///missing-host",
])
def test_invalid_schemes_and_formats_are_blocked(url, fake_dns):
    assert is_safe_url(url) is False


def test_public_domain_is_allowed(fake_dns):
    assert is_safe_url("https://ubuntu.com/security") is True


def test_domain_resolving_to_private_ip_is_blocked(fake_dns):
    fake_dns["internal.example-vendor.test"] = "10.1.2.3"
    fake_dns["v6.example-vendor.test"] = "fd12:3456::1"
    assert is_safe_url("https://internal.example-vendor.test/") is False
    assert is_safe_url("https://v6.example-vendor.test/") is False


def test_unresolvable_domain_is_blocked(fake_dns):
    fake_dns["does-not-exist.test"] = None
    assert is_safe_url("https://does-not-exist.test/") is False
