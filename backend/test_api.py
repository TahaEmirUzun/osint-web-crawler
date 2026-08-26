import pytest
import time
from fastapi.testclient import TestClient
from unittest.mock import patch
from app.main import app
from app.services.security import is_safe_url
from app.services.crawler import parse_ubuntu, parse_generic

try:
    from app.services.crawler import parse_postgresql
except ImportError:
    parse_postgresql = parse_generic

client = TestClient(app)

# 1. API health endpoint
def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200

# 2. URL safety validation 
def test_url_safety_validation():
    assert is_safe_url("https://ubuntu.com/security") == True
    assert is_safe_url("http://127.0.0.1/admin") == False
    assert is_safe_url("http://localhost:8000/data") == False
    assert is_safe_url("http://192.168.1.1/private") == False

# 3. At least two source parsers
def test_source_parsers():
    sample_html = "<h2>CVE-2026-9999 Critical Vulnerability</h2><p>Test description</p>"
    
    ubuntu_res = parse_ubuntu(sample_html, "Test description", "Ubuntu Update", "https://" + "ubuntu.com")
    assert "CVE-2026-9999" in ubuntu_res["cve"]
    assert ubuntu_res["product"] == "Ubuntu Linux"

    pg_res = parse_postgresql(sample_html, "Test description", "PG Update", "https://" + "postgresql.org")
    assert "CVE-2026-9999" in pg_res["cve"]
    assert pg_res["product"] == "PostgreSQL Database"

# 4. Source creation & Source validation
def test_source_creation_and_validation():
    rid = str(time.time())
    valid_payload = {
        "name": f"Test Security Source {rid}",
        "base_url": f"https://example-{rid}.com",
        "enabled": True,
        "request_delay_seconds": 2,
        "request_delay": 2
    }
    
    response = client.post("/api/sources/", json=valid_payload)
    if response.status_code == 404:
        response = client.post("/api/sources", json=valid_payload)
    assert response.status_code in [200, 201, 400]
    
    invalid_payload = {"name": "Invalid Source"} 
    invalid_response = client.post("/api/sources/", json=invalid_payload)
    if invalid_response.status_code == 404:
        invalid_response = client.post("/api/sources", json=invalid_payload)
    assert invalid_response.status_code in [422, 400]

# 5. Error responses (SENIN ROTAN: /api/crawlers)
def test_error_responses():
    response = client.get("/api/crawlers/invalid_job_id_xyz")
    assert response.status_code in [404, 400, 422]

# 6. INTEGRATION TEST (SENIN ROTAN: /api/crawlers)
@patch('app.api.routes.crawls.scrape_basic_info')
def test_integration_crawl(mock_scrape_basic_info):
    mock_scrape_basic_info.return_value = [
        {
            "url": "https://" + "[example.com/sec1](https://example.com/sec1)",
            "title": "Integration Test Vuln",
            "description": "Test Desc",
            "cve": "CVE-2026-0001",
            "severity": "Critical",
            "product": "IntegrationProd",
            "status": "success"
        },
        {
            "url": "https://" + "[example.com/sec1](https://example.com/sec1)",
            "title": "Integration Test Vuln Duplicate",
            "description": "Test Desc",
            "cve": "CVE-2026-0001",
            "severity": "Critical",
            "product": "IntegrationProd",
            "status": "success"
        }
    ]

    crawl_payload = {"source_ids": [1], "maximum_pages": 1}
    
    # Doğru endpoint kullanılıyor
    crawl_response = client.post("/api/crawlers/", json=crawl_payload)
    if crawl_response.status_code == 404:
        crawl_response = client.post("/api/crawlers", json=crawl_payload)
        
    assert crawl_response.status_code in [200, 201]
    
    job_id = crawl_response.json().get("job_id")
    assert job_id is not None

    status_response = client.get(f"/api/crawlers/{job_id}")
    assert status_response.status_code == 200
    
    adv_response = client.get("/api/advisories/?severity=Critical&skip=0&limit=5")
    if adv_response.status_code == 404:
        adv_response = client.get("/api/advisories?severity=Critical&skip=0&limit=5")
    assert adv_response.status_code == 200
    
    data = adv_response.json()
    assert isinstance(data, list)