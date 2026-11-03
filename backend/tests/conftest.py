import os
import socket
import tempfile
from pathlib import Path

import pytest
import requests

# Testler gerçek veritabanına dokunmaz: uygulama import edilmeden önce geçici bir SQLite dosyası ayarlanır.
_TEST_DIR = tempfile.mkdtemp(prefix="osint-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DIR}/test.db"
os.environ["LOG_DIR"] = os.path.join(_TEST_DIR, "logs")
os.environ["AUTO_CRAWL_INTERVAL_HOURS"] = "0"

from fastapi.testclient import TestClient  # noqa: E402

from app.database.base import Base  # noqa: E402
from app.database.connection import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services import crawler  # noqa: E402

FIXTURES_DIR = Path(__file__).parent / "fixtures"
PUBLIC_TEST_IP = "93.184.215.14"


def load_fixture(name: str) -> str:
    return (FIXTURES_DIR / name).read_text(encoding="utf-8")


def make_response(url: str, status: int = 200, body: str = "", headers: dict = None) -> requests.Response:
    response = requests.Response()
    response.status_code = status
    response._content = body.encode("utf-8")
    response.encoding = "utf-8"
    response.url = url
    response.headers.update({"Content-Type": "text/html; charset=utf-8", **(headers or {})})
    return response


class FakeSession:
    """Canlı siteler yerine yerel HTML fixture'larını döndüren sahte HTTP oturumu."""

    def __init__(self, routes: dict):
        self.routes = routes
        self.headers = {"User-Agent": crawler.config.CRAWLER_USER_AGENT}
        self.requested = []

    def get(self, url, timeout=None, allow_redirects=True, **kwargs):
        self.requested.append(url)
        route = self.routes.get(url)
        if route is None:
            return make_response(url, 404, "Not found")
        if isinstance(route, list):
            route = route.pop(0) if len(route) > 1 else route[0]
        if isinstance(route, Exception):
            raise route
        status, body, headers = (route + (None,))[:3] if isinstance(route, tuple) else (200, route, None)
        return make_response(url, status, body, headers)


@pytest.fixture(autouse=True)
def clean_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture(autouse=True)
def no_sleep(monkeypatch):
    monkeypatch.setattr(crawler, "_wait", lambda seconds: None)


@pytest.fixture
def fake_dns(monkeypatch):
    """DNS sorgularını taklit eder; testler internet bağlantısına ihtiyaç duymaz."""
    mapping = {}

    def fake_getaddrinfo(host, port, *args, **kwargs):
        ip = mapping.get(host, PUBLIC_TEST_IP)
        if ip is None:
            raise socket.gaierror("Name or service not known")
        family = socket.AF_INET6 if ":" in ip else socket.AF_INET
        return [(family, socket.SOCK_STREAM, 6, "", (ip, port or 0))]

    monkeypatch.setattr("app.services.security.socket.getaddrinfo", fake_getaddrinfo)
    return mapping


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
