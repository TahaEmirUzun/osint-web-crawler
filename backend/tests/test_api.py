from datetime import datetime

import pytest

from app.models.advisory import Advisory
from app.models.crawl_job import CrawlJob
from app.models.crawl_log import CrawlLog
from app.services import crawl_runner


def create_source(client, **overrides):
    payload = {
        "name": "Example Vendor Advisories",
        "base_url": "https://security.example-vendor.test/security/advisories/",
        "enabled": True,
        "request_delay_seconds": 2,
    }
    payload.update(overrides)
    return client.post("/api/sources", json=payload)


@pytest.fixture
def no_background_crawl(monkeypatch):
    calls = []
    monkeypatch.setattr("app.api.routes.crawls.run_crawl_job", lambda *args, **kwargs: calls.append((args, kwargs)))
    return calls


# 1. API health endpoint
def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "database": "connected", "crawler": "available"}


# 2. Source creation & validation
def test_source_creation(client):
    response = create_source(client)
    assert response.status_code == 201
    body = response.json()
    assert body["id"] > 0
    assert body["enabled"] is True
    assert body["maximum_pages"] == 100

    listed = client.get("/api/sources").json()
    assert [source["name"] for source in listed] == ["Example Vendor Advisories"]


@pytest.mark.parametrize("payload, field", [
    ({"name": "Eksik URL"}, "base_url"),
    ({"name": "Localhost", "base_url": "http://localhost:8000/api/health"}, "base_url"),
    ({"name": "Private", "base_url": "http://192.168.1.10/advisories"}, "base_url"),
    ({"name": "FTP", "base_url": "ftp://example.com/security"}, "base_url"),
    ({"name": "Delay", "base_url": "https://example.com/security", "request_delay_seconds": 0}, "request_delay_seconds"),
    ({"name": "   ", "base_url": "https://example.com/security"}, "name"),
])
def test_source_validation(client, payload, field):
    response = client.post("/api/sources", json=payload)
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert field in [detail["field"] for detail in error["details"]]


def test_duplicate_source_is_rejected(client):
    assert create_source(client).status_code == 201
    response = create_source(client, name="Aynı URL")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "SOURCE_ALREADY_EXISTS"


def test_update_and_toggle_source(client):
    source_id = create_source(client).json()["id"]

    updated = client.put(f"/api/sources/{source_id}", json={
        "name": "Yeni Ad", "base_url": "https://security.example-vendor.test/new", "enabled": True, "request_delay_seconds": 5,
    })
    assert updated.status_code == 200
    assert updated.json()["name"] == "Yeni Ad"
    assert updated.json()["request_delay_seconds"] == 5

    toggled = client.patch(f"/api/sources/{source_id}/status", json={"enabled": False})
    assert toggled.status_code == 200
    assert toggled.json()["enabled"] is False


# 3. Error responses
def test_consistent_error_responses(client):
    response = client.get("/api/sources/9999")
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "SOURCE_NOT_FOUND", "message": "İstenen kaynak bulunamadı."}}

    assert client.get("/api/crawls/invalid_job_id").json()["error"]["code"] == "JOB_NOT_FOUND"
    assert client.get("/api/advisories/9999").json()["error"]["code"] == "ADVISORY_NOT_FOUND"
    assert client.get("/api/does-not-exist").json()["error"]["code"] == "NOT_FOUND"


def test_request_size_is_limited(client):
    response = client.post("/api/sources", content=b"x" * (1024 * 1024 + 10), headers={"Content-Type": "application/json"})
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_internal_errors_do_not_leak_stack_traces(client, monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app

    def explode(*args, **kwargs):
        raise RuntimeError("gizli veritabanı yolu /secret/path")

    monkeypatch.setattr("app.api.routes.statistics.func.lower", explode)
    response = TestClient(app, raise_server_exceptions=False).get("/api/statistics/summary")
    assert response.status_code == 500
    assert "secret" not in response.text
    assert response.json()["error"]["code"] == "INTERNAL_SERVER_ERROR"


# 4. Crawl job creation & status
def test_crawl_job_creation(client, no_background_crawl):
    source_id = create_source(client).json()["id"]

    response = client.post("/api/crawls", json={"source_ids": [source_id], "maximum_pages": 50, "keywords": ["critical"]})
    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "queued"
    assert body["job_id"].startswith("crawl_")
    assert len(no_background_crawl) == 1

    second = client.post("/api/crawls", json={"source_ids": [source_id]}).json()
    assert second["job_id"] != body["job_id"]


@pytest.mark.parametrize("payload", [
    {"source_ids": []},
    {"source_ids": [1], "maximum_pages": 0},
    {"source_ids": [1], "maximum_pages": 100000},
    {"source_ids": [1], "max_depth": 10},
    {"source_ids": [1], "date_from": "not-a-date"},
])
def test_crawl_request_validation(client, payload, no_background_crawl):
    create_source(client)
    response = client.post("/api/crawls", json=payload)
    assert response.status_code == 422
    assert not no_background_crawl


def test_crawl_with_unknown_source_returns_404(client, no_background_crawl):
    response = client.post("/api/crawls", json={"source_ids": [42]})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "SOURCE_NOT_FOUND"


def test_crawl_job_status(client, no_background_crawl):
    source_id = create_source(client).json()["id"]
    job_id = client.post("/api/crawls", json={"source_ids": [source_id]}).json()["job_id"]

    status = client.get(f"/api/crawls/{job_id}")
    assert status.status_code == 200
    body = status.json()
    for key in ("job_id", "status", "progress_percentage", "pages_visited", "records_extracted", "errors", "started_at"):
        assert key in body
    assert body["source_names"] == ["Example Vendor Advisories"]

    jobs = client.get("/api/crawls").json()
    assert [job["id"] for job in jobs] == [job_id]


def test_stop_crawl(client, no_background_crawl, db_session):
    source_id = create_source(client).json()["id"]
    job_id = client.post("/api/crawls", json={"source_ids": [source_id]}).json()["job_id"]

    response = client.post(f"/api/crawls/{job_id}/stop")
    assert response.status_code == 200
    assert response.json()["status"] == "stopping"

    # Arka plan görevi durdurma isteğini görüp 'stopped' durumuna geçer
    crawl_runner.run_crawl_job(job_id, [source_id])
    assert client.get(f"/api/crawls/{job_id}").json()["status"] == "stopped"

    finished = client.post(f"/api/crawls/{job_id}/stop")
    assert finished.status_code == 409
    assert finished.json()["error"]["code"] == "JOB_ALREADY_FINISHED"


# 5. Advisory filtering & pagination
@pytest.fixture
def sample_advisories(db_session):
    rows = [
        Advisory(title="Critical RCE", organization="Canonical (Ubuntu)", severity="Critical", cve="CVE-2026-0001",
                 url="https://ubuntu.com/a1", source_domain="https://ubuntu.com/security/notices", product="Ubuntu Linux",
                 publication_date=datetime(2026, 5, 1)),
        Advisory(title="High DoS", organization="PostgreSQL Global Development Group", severity="High", cve="CVE-2026-0002",
                 url="https://postgresql.org/a2", source_domain="https://www.postgresql.org/support/security", product="PostgreSQL Database",
                 publication_date=datetime(2025, 12, 1)),
        Advisory(title="Low info leak", organization="Canonical (Ubuntu)", severity="Low", cve="CVE-2026-0003",
                 url="https://ubuntu.com/a3", source_domain="https://ubuntu.com/security/notices", product="Ubuntu Linux",
                 summary="remote code execution not possible", publication_date=datetime(2026, 7, 1)),
    ]
    db_session.add_all(rows)
    db_session.commit()
    return rows


def test_advisory_filtering(client, sample_advisories):
    def titles(query):
        return sorted(item["title"] for item in client.get(f"/api/advisories?{query}").json())

    assert titles("severity=critical") == ["Critical RCE"]
    assert titles("organization=canonical") == ["Critical RCE", "Low info leak"]
    assert titles("source=postgresql") == ["High DoS"]
    assert titles("keyword=remote code") == ["Low info leak"]
    assert titles("keyword=CVE-2026-0002") == ["High DoS"]
    assert titles("date_from=2026-01-01") == ["Critical RCE", "Low info leak"]
    assert titles("date_from=2026-01-01&date_to=2026-06-01") == ["Critical RCE"]


def test_advisory_pagination_and_sorting(client, sample_advisories):
    first_page = client.get("/api/advisories?page=1&page_size=2&sort_by=title&sort_order=asc")
    assert first_page.status_code == 200
    assert first_page.headers["X-Total-Count"] == "3"
    assert [item["title"] for item in first_page.json()] == ["Critical RCE", "High DoS"]

    second_page = client.get("/api/advisories?page=2&page_size=2&sort_by=title&sort_order=asc").json()
    assert [item["title"] for item in second_page] == ["Low info leak"]

    assert client.get("/api/advisories?sort_by=password").status_code == 422
    assert client.get("/api/advisories?page=0").status_code == 422


def test_advisory_details_and_delete(client, sample_advisories):
    advisory_id = sample_advisories[0].id
    details = client.get(f"/api/advisories/{advisory_id}").json()
    assert details["url"] == "https://ubuntu.com/a1"
    assert details["organization"] == "Canonical (Ubuntu)"

    assert client.delete(f"/api/advisories/{advisory_id}").status_code == 200
    assert client.get(f"/api/advisories/{advisory_id}").status_code == 404


def test_statistics_summary(client, sample_advisories, db_session):
    db_session.add_all([CrawlJob(id="crawl_x_001", status="completed"), CrawlJob(id="crawl_x_002", status="failed")])
    db_session.commit()
    summary = client.get("/api/statistics/summary").json()
    assert summary["total_advisories"] == 3
    assert summary["critical"] == 1 and summary["high"] == 1 and summary["low"] == 1
    assert summary["completed_crawls"] == 1
    assert summary["failed_crawls"] == 1


def test_log_filters(client, db_session):
    db_session.add_all([
        CrawlLog(crawl_job_id=None, log_level="INFO", message="a", source="https://ubuntu.com", timestamp=datetime(2026, 1, 1)),
        CrawlLog(crawl_job_id=None, log_level="ERROR", message="b", source="https://debian.org", timestamp=datetime(2026, 2, 1)),
    ])
    db_session.commit()
    assert [log["message"] for log in client.get("/api/logs?level=error").json()] == ["b"]
    assert [log["message"] for log in client.get("/api/logs?source=ubuntu").json()] == ["a"]
    assert [log["message"] for log in client.get("/api/logs?date_from=2026-01-15").json()] == ["b"]


# 6. Duplicate handling
def test_duplicate_records_are_not_inserted_twice(db_session):
    from app.models.source import Source

    source = Source(name="Dup", base_url="https://dup.example.test/security")
    db_session.add_all([source, CrawlJob(id="crawl_dup_001", status="running")])
    db_session.commit()

    record = {"url": "https://dup.example.test/security/1", "title": "Adv", "cve": "CVE-2026-1", "severity": "High"}
    assert crawl_runner.save_records(db_session, [record, dict(record)], source, "crawl_dup_001") == (1, 0)
    assert crawl_runner.save_records(db_session, [dict(record, severity="Critical")], source, "crawl_dup_001") == (0, 1)

    rows = db_session.query(Advisory).filter(Advisory.url == record["url"]).all()
    assert len(rows) == 1
    assert rows[0].severity == "Critical"
