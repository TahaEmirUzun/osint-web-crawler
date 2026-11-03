import pytest
import requests

from app.services.crawler import AccessBlockedError, CrawlerEngine, RobotsDisallowedError, UnsafeUrlError
from conftest import FakeSession, load_fixture

BASE = "https://security.example-vendor.test"
INDEX = f"{BASE}/security/advisories/"
ADV1 = f"{BASE}/security/advisories/EV-2026-001.html"
ADV2 = f"{BASE}/security/advisories/EV-2026-002.html"
ROBOTS = f"{BASE}/robots.txt"


def vendor_routes(robots="User-agent: *\nDisallow: /private/\n"):
    return {
        ROBOTS: robots,
        INDEX: load_fixture("vendor_index.html"),
        ADV1: load_fixture("vendor_advisory_1.html"),
        ADV2: load_fixture("vendor_advisory_2.html"),
        f"{BASE}/private/internal-report.html": "<html><title>Security internal</title></html>",
        f"{BASE}/account/login": load_fixture("login.html"),
    }


def test_crawl_follows_links_without_duplicates_and_respects_rules(fake_dns):
    session = FakeSession(vendor_routes())
    result = CrawlerEngine(delay=1, max_pages=10, max_depth=2, session=session).crawl(INDEX)

    urls = sorted(record["url"] for record in result.records)
    assert urls == sorted([INDEX, ADV1, ADV2])
    assert result.pages_visited == 3
    # robots.txt yasağı, login sayfası ve dış domain ziyaret edilmez; aynı URL iki kez istenmez
    assert f"{BASE}/private/internal-report.html" not in session.requested
    assert f"{BASE}/account/login" not in session.requested
    assert not any("other-domain" in url for url in session.requested)
    assert session.requested.count(ADV2) == 1
    assert session.requested.count(ROBOTS) == 1


def test_crawl_uses_descriptive_user_agent(fake_dns):
    engine = CrawlerEngine(session=FakeSession(vendor_routes()))
    assert engine.user_agent.startswith("OSINT-Advisory-Crawler/")


def test_maximum_pages_limit_is_respected(fake_dns):
    result = CrawlerEngine(max_pages=2, max_depth=3, session=FakeSession(vendor_routes())).crawl(INDEX)
    assert result.pages_visited == 2


def test_max_depth_one_only_visits_start_page(fake_dns):
    session = FakeSession(vendor_routes())
    result = CrawlerEngine(max_depth=1, session=session).crawl(INDEX)
    assert result.pages_visited == 1
    assert ADV1 not in session.requested


def test_robots_disallow_stops_crawl(fake_dns):
    session = FakeSession(vendor_routes(robots="User-agent: *\nDisallow: /\n"))
    with pytest.raises(RobotsDisallowedError):
        CrawlerEngine(session=session).crawl(INDEX)
    assert INDEX not in session.requested


def test_unsafe_start_url_is_rejected(fake_dns):
    fake_dns["security.example-vendor.test"] = "192.168.0.10"
    with pytest.raises(UnsafeUrlError):
        CrawlerEngine(session=FakeSession(vendor_routes())).crawl(INDEX)


def test_redirect_to_internal_address_is_blocked(fake_dns):
    routes = vendor_routes()
    routes[ADV1] = (302, "", {"Location": "http://169.254.169.254/latest/meta-data/"})
    session = FakeSession(routes)
    result = CrawlerEngine(session=session).crawl(INDEX)

    assert "http://169.254.169.254/latest/meta-data/" not in session.requested
    assert result.errors == 1
    assert ADV1 not in [record["url"] for record in result.records]


def test_temporary_failures_are_retried(fake_dns):
    routes = vendor_routes()
    routes[INDEX] = [(503, "busy"), requests.Timeout("timeout"), (200, load_fixture("vendor_index.html"))]
    result = CrawlerEngine(max_depth=1, session=FakeSession(routes)).crawl(INDEX)
    assert result.pages_visited == 1


def test_access_denied_start_page_stops_crawl(fake_dns):
    routes = vendor_routes()
    routes[INDEX] = (403, "Forbidden")
    session = FakeSession(routes)
    with pytest.raises(AccessBlockedError):
        CrawlerEngine(session=session).crawl(INDEX)
    # 403 tekrar denenmez
    assert session.requested.count(INDEX) == 1


def test_stop_callback_interrupts_crawl(fake_dns):
    result = CrawlerEngine(session=FakeSession(vendor_routes()), should_stop=lambda: True).crawl(INDEX)
    assert result.stopped is True
    assert result.pages_visited == 0
