from app.services import crawler
from conftest import FakeSession, load_fixture

BASE = "https://security.example-vendor.test"
INDEX = f"{BASE}/security/advisories/"


def test_crawl_end_to_end_through_rest_api(client, fake_dns, monkeypatch):
    """REST API ile tarama başlatır, yerel HTML fixture'larını işler, kayıtları kaydeder ve API'den geri okur."""
    routes = {
        f"{BASE}/robots.txt": "User-agent: *\nDisallow: /private/\n",
        INDEX: load_fixture("vendor_index.html"),
        f"{BASE}/security/advisories/EV-2026-001.html": load_fixture("vendor_advisory_1.html"),
        f"{BASE}/security/advisories/EV-2026-002.html": load_fixture("vendor_advisory_2.html"),
    }
    monkeypatch.setattr(crawler, "create_session", lambda: FakeSession(routes))

    # 1. Kaynak ekle ve REST API üzerinden taramayı başlat
    source = client.post("/api/sources", json={"name": "Example Vendor", "base_url": INDEX, "request_delay_seconds": 1}).json()
    start = client.post("/api/crawls", json={"source_ids": [source["id"]], "maximum_pages": 10, "max_depth": 2, "date_from": "2026-01-01"})
    assert start.status_code == 202
    job_id = start.json()["job_id"]

    # 2. TestClient arka plan görevini yanıt döndükten sonra çalıştırır; görev tamamlanmış olmalı
    job = client.get(f"/api/crawls/{job_id}").json()
    assert job["status"] == "completed"
    assert job["progress_percentage"] == 100
    assert job["pages_visited"] == 3

    # 3. Kayıtlar API üzerinden okunabilmeli (2025 tarihli EV-2026-002 date_from filtresiyle elenir)
    advisories = client.get(f"/api/advisories?source={INDEX}&sort_by=url&sort_order=asc").json()
    urls = [item["url"] for item in advisories]
    assert f"{BASE}/security/advisories/EV-2026-001.html" in urls
    assert f"{BASE}/security/advisories/EV-2026-002.html" not in urls
    assert job["records_extracted"] == len(advisories)

    critical = client.get("/api/advisories?severity=Critical").json()
    assert len(critical) == 1
    assert critical[0]["cve"] == "CVE-2026-11111"
    assert critical[0]["crawl_job_id"] == job_id
    assert critical[0]["url"].startswith(BASE)

    # 4. Kaynak son tarama sonucu ve loglar güncellenmiş olmalı
    updated_source = client.get(f"/api/sources/{source['id']}").json()
    assert updated_source["last_crawl_status"] == "completed"
    assert updated_source["last_crawl_date"] is not None

    logs = client.get(f"/api/logs?job_id={job_id}").json()
    assert any("başarıyla tamamlandı" in log["message"] for log in logs)

    # 5. Aynı tarama tekrar çalıştırıldığında mükerrer kayıt oluşmaz
    second_job = client.post("/api/crawls", json={"source_ids": [source["id"]], "date_from": "2026-01-01"}).json()["job_id"]
    assert client.get(f"/api/crawls/{second_job}").json()["records_extracted"] == 0
    assert len(client.get(f"/api/advisories?source={INDEX}").json()) == len(advisories)


def test_failed_source_does_not_abort_other_sources(client, fake_dns, monkeypatch):
    routes = {
        f"{BASE}/robots.txt": "",
        INDEX: load_fixture("vendor_index.html"),
        "https://blocked.example.test/robots.txt": "",
        "https://blocked.example.test/security": (403, "Forbidden"),
    }
    monkeypatch.setattr(crawler, "create_session", lambda: FakeSession(routes))

    blocked = client.post("/api/sources", json={"name": "Blocked", "base_url": "https://blocked.example.test/security"}).json()
    working = client.post("/api/sources", json={"name": "Working", "base_url": INDEX}).json()

    job_id = client.post("/api/crawls", json={"source_ids": [blocked["id"], working["id"]], "max_depth": 1}).json()["job_id"]
    job = client.get(f"/api/crawls/{job_id}").json()

    assert job["status"] == "completed"
    assert job["error_count"] == 1
    assert job["records_extracted"] == 1
    assert client.get(f"/api/sources/{blocked['id']}").json()["last_crawl_status"] == "failed"
