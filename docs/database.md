# Database Design (ER Diagram)

Projede toplanan siber istihbarat verilerini, kaynak yapılandırmalarını ve sistem loglarını kalıcı olarak saklamak için oluşturulan ilişkisel veritabanı şeması aşağıdadır.

```mermaid
erDiagram
SOURCES {
integer id PK
string name
string base_url
boolean enabled
integer request_delay
datetime created_date
datetime updated_date
datetime last_crawl_date
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
}
ADVISORIES {
integer id PK
string title
string url
string cve
string severity
string product
string source_domain
string summary
string organization
datetime publication_date
datetime collection_date
string crawl_job_id FK
}
CRAWL_LOGS {
integer id PK
string crawl_job_id FK
string log_level
string message
string source
datetime timestamp
}
CRAWL_JOBS ||--o{ ADVISORIES : "extracts"
CRAWL_JOBS ||--o{ CRAWL_LOGS : "generates"