from fastapi.testclient import TestClient
from app.main import app

# FastAPI'nin kendi sanal test istemcisini başlatıyoruz
client = TestClient(app)

# 1. Test: Sağlık Kontrolü (Health Check) Ucu Çalışıyor mu?
def test_health_check():
    response = client.get("/api/health")
    # Sunucunun 200 (Başarılı) dönmesini bekliyoruz
    assert response.status_code == 200
    # Dönen JSON verisinin dokümanda istenen formata uymasını bekliyoruz
    assert response.json() == {
        "status": "healthy",
        "database": "connected",
        "crawler": "available"
    }

# 2. Test: Yeni Kaynak (Source) Ekleme Çalışıyor mu?
def test_create_source():
    payload = {
        "name": "Pytest Güvenlik Kaynağı",
        "base_url": "https://pytest-test-domain.com",
        "enabled": True,
        "request_delay_seconds": 2
    }
    response = client.post("/api/sources/", json=payload)
    
    # 200 başarılı kodu dönmeli
    assert response.status_code == 200
    
    # Dönen veri, gönderdiğimiz verilerle eşleşmeli
    data = response.json()
    assert data["name"] == "Pytest Güvenlik Kaynağı"
    assert data["base_url"] == "https://pytest-test-domain.com"

# 3. Test: Dashboard İstatistikleri Çalışıyor mu?
def test_get_statistics():
    response = client.get("/api/statistics/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_advisories" in data
    assert "critical" in data

# 4. Test: Zafiyetleri Listeleme ve Sayfalama Çalışıyor mu?
def test_get_advisories():
    response = client.get("/api/advisories/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)