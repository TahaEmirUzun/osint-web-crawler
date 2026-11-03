from datetime import datetime

from app.services.crawler import extract_severity, parse_generic, parse_page, parse_postgresql, parse_ubuntu
from conftest import load_fixture


def test_ubuntu_parser_extracts_fields_from_fixture():
    record = parse_page(load_fixture("ubuntu_notice.html"), "https://ubuntu.com/security/notices/USN-8631-1")

    assert record["title"] == "[Ubuntu] USN-8631-1: OpenSSL vulnerabilities"
    assert record["cve"] == "CVE-2026-53212, CVE-2026-53213"
    # Menüdeki "Low latency" kelimesi değil, "Priority: High" etiketi okunmalı
    assert record["severity"] == "High"
    assert record["product"] == "Ubuntu Linux"
    assert record["organization"] == "Canonical (Ubuntu)"
    assert record["publication_date"] == datetime(2026, 8, 20)
    assert record["url"] == "https://ubuntu.com/security/notices/USN-8631-1"


def test_postgresql_parser_extracts_fields_from_fixture():
    record = parse_page(load_fixture("postgresql_advisory.html"), "https://www.postgresql.org/support/security/CVE-2026-6479/")

    assert record["title"].startswith("[PostgreSQL] CVE-2026-6479")
    assert record["cve"] == "CVE-2026-6479"
    assert record["severity"] == "High"  # CVSS 7.5
    assert record["product"] == "PostgreSQL Database"
    assert record["organization"] == "PostgreSQL Global Development Group"
    assert record["publication_date"] == datetime(2026, 8, 14)
    assert "Uncontrolled recursion" in record["description"]


def test_generic_parser_extracts_fields_from_fixture():
    record = parse_page(load_fixture("vendor_advisory_1.html"), "https://security.example-vendor.test/security/advisories/EV-2026-001.html")

    assert record["cve"] == "CVE-2026-11111"
    assert record["severity"] == "Critical"
    assert record["organization"] == "security.example-vendor.test"
    assert record["publication_date"] == datetime(2026, 3, 10, 8, 0)


def test_parser_functions_keep_backwards_compatible_signature():
    sample_html = "<h2>CVE-2026-9999 Critical Vulnerability</h2><p>Test description</p>"

    ubuntu_res = parse_ubuntu(sample_html, "Test description", "Ubuntu Update", "https://ubuntu.com")
    assert "CVE-2026-9999" in ubuntu_res["cve"]
    assert ubuntu_res["product"] == "Ubuntu Linux"

    pg_res = parse_postgresql(sample_html, "Test description", "PG Update", "https://postgresql.org")
    assert "CVE-2026-9999" in pg_res["cve"]
    assert pg_res["product"] == "PostgreSQL Database"

    generic_res = parse_generic(sample_html, "", "Generic", "https://example.com", "example.com")
    assert generic_res["severity"] == "Critical"


def test_severity_is_unknown_when_not_present():
    assert extract_severity("No rating information here") == "Unknown"
    assert extract_severity("Impact: Important") == "High"
    assert extract_severity("Severity rating: moderate") == "Medium"
