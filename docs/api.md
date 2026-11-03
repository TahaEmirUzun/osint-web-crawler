# REST API Documentation

This document outlines the RESTful API endpoints provided by the OSINT Web Crawler backend. The API is the sole communication layer between the React frontend and the Python crawler engine.

* **Base URL:** `http://localhost:8000`
* **Interactive docs (Swagger UI):** `http://localhost:8000/docs`
* **OpenAPI schema:** `http://localhost:8000/openapi.json`
* All request and response bodies are JSON. Timestamps are UTC (ISO 8601).

## Error Format

Every error response uses the same structure. Internal details and stack traces are never returned.

```json
{
  "error": {
    "code": "SOURCE_NOT_FOUND",
    "message": "İstenen kaynak bulunamadı."
  }
}
```

Validation errors (`422`) also include field details:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "İstek verileri doğrulanamadı.",
    "details": [
      { "field": "base_url", "message": "İç ağa ait IP adresi engellendi." }
    ]
  }
}
```

| HTTP | Code | When |
|---|---|---|
| 400 | `NO_ENABLED_SOURCES` | None of the selected sources is enabled |
| 404 | `SOURCE_NOT_FOUND`, `JOB_NOT_FOUND`, `ADVISORY_NOT_FOUND`, `NOT_FOUND` | Resource does not exist |
| 409 | `SOURCE_ALREADY_EXISTS`, `JOB_ALREADY_FINISHED` | Conflict with the current state |
| 413 | `PAYLOAD_TOO_LARGE` | Request body exceeds `MAX_REQUEST_BODY_BYTES` |
| 422 | `VALIDATION_ERROR` | Invalid input |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server error |
| 503 | — | Health check: database is not reachable |

---

## 1. System Health

### Check Health Status
* **Endpoint:** `GET /api/health`
* **Response (200 OK):**
```json
{
  "status": "healthy",
  "database": "connected",
  "crawler": "available"
}
```
Returns `503` with `"status": "unhealthy"` when the database query fails.

---

## 2. Sources Management

### List All Sources
* **Endpoint:** `GET /api/sources?skip=0&limit=100`
* **Response (200 OK):**
```json
[
  {
    "id": 20,
    "name": "Ubuntu Security Notices",
    "base_url": "https://ubuntu.com/security/notices",
    "enabled": true,
    "request_delay_seconds": 2,
    "maximum_pages": 100,
    "created_date": "2026-08-21T18:53:29.934517",
    "updated_date": "2026-08-26T20:34:09.860481",
    "last_crawl_date": "2026-08-26T20:34:09.852851",
    "last_crawl_status": "completed",
    "last_crawl_records": 12
  }
]
```

### Add a New Source
* **Endpoint:** `POST /api/sources`
* **Validation:** `base_url` must be `http/https` and must not point to localhost or private/internal addresses; `request_delay_seconds` 1–60; `maximum_pages` 1–500.
* **Request Body:**
```json
{
  "name": "PostgreSQL Security",
  "base_url": "https://www.postgresql.org/support/security/",
  "enabled": true,
  "request_delay_seconds": 2,
  "maximum_pages": 100
}
```
* **Response:** `201 Created` with the created source. `409 SOURCE_ALREADY_EXISTS` if the URL is already registered.

### Update a Source
* **Endpoint:** `PUT /api/sources/{source_id}` — same body as create.

### Enable or Disable a Source
* **Endpoint:** `PATCH /api/sources/{source_id}/status`
```json
{ "enabled": false }
```

### Check robots.txt
* **Endpoint:** `GET /api/sources/{source_id}/robots`
```json
{
  "source_id": 20,
  "url": "https://ubuntu.com/security/notices",
  "robots_url": "https://ubuntu.com/robots.txt",
  "allowed": true,
  "reason": null
}
```

### Export Source Advisories as CSV
* **Endpoint:** `GET /api/sources/{source_id}/export` — `text/csv`, `;` separated, UTF-8 BOM.

### Delete a Source
* **Endpoint:** `DELETE /api/sources/{source_id}`

---

## 3. Crawl Job Management

Crawls run as background jobs, so the request returns immediately. Job statuses: `queued`, `running`, `completed`, `failed`, `stopping`, `stopped`.

### Start a Crawl Job
* **Endpoint:** `POST /api/crawls`
* **Validation:** `source_ids` 1–50 items; `maximum_pages` 1–500 (total for the job); `max_depth` 1–3; `date_from` `YYYY-MM-DD`; up to 20 keywords.
* **Request Body:**
```json
{
  "source_ids": [13, 20],
  "maximum_pages": 100,
  "max_depth": 2,
  "date_from": "2026-01-01",
  "keywords": ["critical", "remote code execution"]
}
```
* **Response (202 Accepted):**
```json
{
  "job_id": "crawl_20261103_001",
  "status": "queued"
}
```

### List Crawl Jobs
* **Endpoint:** `GET /api/crawls?status=running&skip=0&limit=100`

### Get Crawl Status & Progress
* **Endpoint:** `GET /api/crawls/{job_id}`
* **Response (200 OK):**
```json
{
  "id": "crawl_20261103_001",
  "job_id": "crawl_20261103_001",
  "status": "running",
  "progress": 45,
  "progress_percentage": 45,
  "pages_visited": 90,
  "records_extracted": 37,
  "error_count": 2,
  "errors": 2,
  "started_date": "2026-11-03T10:00:00",
  "started_at": "2026-11-03T10:00:00",
  "completed_date": null,
  "completed_at": null,
  "configuration": { "source_ids": [13, 20], "maximum_pages": 100, "max_depth": 2, "date_from": "2026-01-01", "keywords": ["critical"] },
  "source_ids": [13, 20],
  "source_names": ["PostgreSQL Security Vulnerabilities", "Ubuntu Security Notices"]
}
```

### Stop a Running Crawl
* **Endpoint:** `POST /api/crawls/{job_id}/stop`
* The job switches to `stopping`; the background worker finishes the current page and then sets `stopped`.
* **Response (200 OK):**
```json
{
  "message": "crawl_20261103_001 numaralı görev durduruluyor.",
  "job_id": "crawl_20261103_001",
  "status": "stopping"
}
```
* `409 JOB_ALREADY_FINISHED` if the job is already `completed`, `failed` or `stopped`.

---

## 4. Advisories (Vulnerability Data)

### List Advisories
* **Endpoint:** `GET /api/advisories`
* **Query parameters:**

| Parameter | Description |
|---|---|
| `page`, `page_size` | Page-based pagination (`page_size` ≤ 500) |
| `skip`, `limit` | Offset-based pagination (used when `page` is not given, `limit` ≤ 1000) |
| `severity` | `Critical`, `High`, `Medium`, `Low`, `Unknown` (case-insensitive) |
| `organization` | Publishing organization (partial match) |
| `source` | Source URL (partial match) |
| `product` | Affected product (partial match) |
| `keyword` | Search in title, summary, URL and CVE |
| `date_from`, `date_to` | Publication date (falls back to collection date) |
| `sort_by` | `id`, `title`, `organization`, `publication_date`, `severity`, `cve`, `product`, `source_domain`, `collection_date`, `url` |
| `sort_order` | `asc` or `desc` |

The total number of matching records is returned in the `X-Total-Count` header.

* **Example:** `GET /api/advisories?severity=critical&organization=canonical&page=1&page_size=25`
* **Response (200 OK):**
```json
[
  {
    "id": 234,
    "title": "[PostgreSQL] CVE-2026-6479: PostgreSQL SSL/GSS init causes denial of service, via uncontrolled recursion",
    "organization": "PostgreSQL Global Development Group",
    "publication_date": "2026-08-14T00:00:00",
    "url": "https://www.postgresql.org/support/security/CVE-2026-6479/",
    "source_domain": "https://www.postgresql.org/support/security",
    "cve": "CVE-2026-6479",
    "product": "PostgreSQL Database",
    "severity": "High",
    "summary": "Uncontrolled recursion in SSL/GSS initialization allows a remote attacker to crash the server.",
    "collection_date": "2026-08-26T20:32:35.497165",
    "last_updated": "2026-08-26T20:32:35.497170",
    "crawl_job_id": "crawl_20260826_001"
  }
]
```

### Get Advisory Details
* **Endpoint:** `GET /api/advisories/{advisory_id}`

### Delete an Advisory
* **Endpoint:** `DELETE /api/advisories/{advisory_id}`
```json
{ "detail": "ID 234 olan zafiyet kaydı silindi." }
```

---

## 5. Dashboard Statistics

### Summary
* **Endpoint:** `GET /api/statistics/summary`
```json
{
  "total_advisories": 197,
  "critical": 11,
  "high": 49,
  "medium": 117,
  "low": 20,
  "unknown": 0,
  "active_sources": 7,
  "total_sources": 7,
  "completed_crawls": 71,
  "failed_crawls": 9,
  "running_crawls": 0
}
```

### Timeline
* **Endpoint:** `GET /api/statistics/timeline?date_field=collection_date` (or `publication_date`)
```json
[
  { "date": "2026-08-17", "count": 49 },
  { "date": "2026-08-26", "count": 37 }
]
```

---

## 6. Logs

### View Logs
* **Endpoint:** `GET /api/logs`
* **Query parameters:** `level` (`INFO`, `WARNING`, `ERROR`), `job_id`, `source`, `date_from`, `date_to`, `skip`, `limit` (≤ 1000). Total count in `X-Total-Count`.
* **Response (200 OK):**
```json
[
  {
    "id": 512,
    "crawl_job_id": "crawl_20261103_001",
    "timestamp": "2026-11-03T10:00:05",
    "log_level": "INFO",
    "message": "'Ubuntu Security Notices' taraması bitti. 11 sayfa, 9 yeni, 0 güncellenen zafiyet.",
    "source": "https://ubuntu.com/security/notices"
  }
]
```

> **Note:** The old `/api/crawlers` prefix is still accepted for backwards compatibility but is hidden from the OpenAPI docs. New clients should use `/api/crawls`.
