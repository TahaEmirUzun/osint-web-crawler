# Database Design (ER Diagram)

Projede toplanan siber istihbarat verilerini, kaynak yapılandırmalarını ve sistem loglarını kalıcı olarak saklamak için oluşturulan ilişkisel veritabanı şeması aşağıdadır.

```mermaid
erDiagram
SOURCES {
integer id PK
string name
string base_url UK
boolean enabled
integer request_delay_seconds
integer maximum_pages
datetime created_date
datetime updated_date
datetime last_crawl_date
string last_crawl_status
integer last_crawl_records
}
CRAWL_JOBS {
string id PK
string status
integer progress
datetime started_date
datetime completed_date
integer pages_visited
integer records_extracted
integer error_count
json configuration
}
ADVISORIES {
integer id PK
string title
string organization
datetime publication_date
string url
string source_domain
string cve
string product
string severity
string summary
datetime collection_date
datetime last_updated
string crawl_job_id FK
}
CRAWL_LOGS {
integer id PK
string crawl_job_id FK
datetime timestamp
string log_level
string message
string source
}
SOURCES ||--o{ ADVISORIES : "source_domain = base_url"
CRAWL_JOBS ||--o{ ADVISORIES : "extracts"
CRAWL_JOBS ||--o{ CRAWL_LOGS : "generates"
```

## Notlar

- `crawl_jobs.configuration` alanı taramanın isteğini (seçilen kaynaklar, `maximum_pages`, `max_depth`, `date_from`, `keywords`) JSON olarak saklar.
- `advisories.url` mükerrer kayıt kontrolünde kullanılır; aynı URL tekrar toplandığında yeni kayıt açılmaz, mevcut kayıt ve `last_updated` güncellenir.
- Zaman damgaları UTC olarak saklanır, arayüzde kullanıcının yerel saatine çevrilir.

## Migrasyonlar

Tablolar ilk açılışta `Base.metadata.create_all()` ile oluşturulur. Mevcut veritabanlarına sonradan eklenen kolonlar `app/database/connection.py` içindeki `SCHEMA_MIGRATIONS` sözlüğü ile uygulama başlarken otomatik eklenir:

| Tablo | Kolon | Tip |
|---|---|---|
| `advisories` | `last_updated` | `DATETIME` |
| `sources` | `maximum_pages` | `INTEGER DEFAULT 100` |
| `sources` | `last_crawl_status` | `VARCHAR` |
| `sources` | `last_crawl_records` | `INTEGER` |
