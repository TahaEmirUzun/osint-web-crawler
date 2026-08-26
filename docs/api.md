# REST API Documentation

This document outlines the core RESTful API endpoints provided by the OSINT Web Crawler backend. The API acts as the sole communication layer between the React Frontend and the Python Crawler Engine.

## 1. System Health

### Check Health Status
Checks the status of the API, database, and crawler engine.
* **Endpoint:** `GET /api/health`
* **Response (200 OK):**
```json
{
  "status": "healthy",
  "database": "connected",
  "crawler": "available"
}
```

---

## 2. Sources Management

### List All Sources
Retrieves a list of all configured target sources.
* **Endpoint:** `GET /api/sources`
* **Response (200 OK):**
```json
[
  {
    "name": "Ubuntu Security Notices",
    "base_url": "https://ubuntu.com/security/notices",
    "enabled": true,
    "request_delay_seconds": 2,
    "id": 20,
    "created_date": "2026-08-21T18:53:29.934517",
    "updated_date": "2026-08-26T20:34:09.860481",
    "last_crawl_date": "2026-08-26T20:34:09.852851"
  }
]
```

### Add a New Source
Adds a new target URL to the system.
* **Endpoint:** `POST /api/sources`
* **Request Body:**
```json
{
  "name": "PostgreSQL Security",
  "base_url": "https://www.postgresql.org/support/security/",
  "enabled": true,
  "request_delay_seconds": 2
}
```

---

## 3. Crawl Job Management

### Start a Crawl Job
Initiates a background crawl job for the selected sources.
* **Endpoint:** `POST /api/crawls`
* **Request Body:**
```json
{
  "source_ids": [
    13,20
  ],
  "maximum_pages": 100,
  "date_from": "string",
  "keywords": [
    "string"
  ]
}
```
* **Response (200 OK):**
```json
{
  "job_id": "crawl_20260826_210336",
  "status": "queued"
}
```

### Get Crawl Status & Progress
Retrieves live progress metrics for a specific job.
* **Endpoint:** `GET /api/crawls/{job_id}`
* **Response (200 OK):**
```json
{
  "id": "crawl_20260826_210336",
  "started_date": "2026-08-26T21:03:36.512688",
  "pages_visited": 11,
  "error_count": 0,
  "completed_date": null,
  "progress": 45,
  "status": "running",
  "records_extracted": 0,
  "configuration": null
}
```

### Stop a Running Crawl
Safely terminates a background crawl job.
* **Endpoint:** `POST /api/crawls/{job_id}/stop`
* **Response (200 OK):**
```json
{
  "message": "Görev başarıyla durduruldu.",
  "status": "stopped"
}
```

---

## 4. Advisories (Vulnerability Data)

### List Advisories
Retrieves structured vulnerability records. Supports pagination and filtering.
* **Endpoint:** `GET /api/advisories`
* **Response (200 OK):**
```json
[  
    {
    "id": 236,
    "title": "[Ubuntu] CVE-2026-53212\n    | Ubuntu",
    "url": "https://ubuntu.com/security/CVE-2026-53212",
    "cve": "CVE-2026-53212, USN-8631-3, USN-8631-1, USN-8660-1, USN-8667-1, USN-8669-1, USN-8630-4, USN-8636-1, USN-8666-2, USN-8661-2, USN-8636-2, USN-8664-1, USN-8631-2, USN-8630-1, USN-8661-1, USN-8630-3, USN-8663-1, USN-8630-5, USN-8666-1, USN-8629-1, USN-8630-2, USN-8637-1, USN-8629-3, USN-8631-4, USN-8656-1, USN-8629-2",
    "severity": "High",
    "product": "Ubuntu Linux",
    "source_domain": "https://ubuntu.com/security/notices",
    "collection_date": "2026-08-26T20:34:09.853057",
    "summary": "\n        Ubuntu is an open source software operating system that runs from the desktop, to the cloud, to all your internet connected things.",
    "crawl_job_id": "crawl_20260826_210336"
  }, 
  {
    "id": 235,
    "title": "[Ubuntu] CVE-2026-73073\n    | Ubuntu",
    "url": "https://ubuntu.com/security/CVE-2026-73073",
    "cve": "CVE-2026-73073, USN-8679-1",
    "severity": "Medium",
    "product": "Ubuntu Linux",
    "source_domain": "https://ubuntu.com/security/notices",
    "collection_date": "2026-08-26T20:34:09.853056",
    "summary": "\n        Ubuntu is an open source software operating system that runs from the desktop, to the cloud, to all your internet connected things.",
    "crawl_job_id": "crawl_20260826_210336"
  },
  {
    "id": 234,
    "title": "[PostgreSQL] PostgreSQL: CVE-2026-6479: PostgreSQL SSL/GSS init causes denial of service, via uncontrolled recursion",
    "url": "https://www.postgresql.org/support/security/CVE-2026-6479/",
    "cve": "CVE-2026-6479",
    "severity": "Medium",
    "product": "PostgreSQL Database",
    "source_domain": "https://www.postgresql.org/support/security",
    "collection_date": "2026-08-26T20:32:35.497165",
    "summary": "",
    "crawl_job_id": "crawl_20260826_210336"
  }
]
```