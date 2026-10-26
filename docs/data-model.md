# Модель данных

```mermaid
erDiagram
    USERS ||--|| USER_INFO : has
    USERS ||--o{ APPLICATIONS : submits
    LOANS ||--o{ APPLICATIONS : selected_for
    APPLICATIONS ||--o{ APPLICATIONS_LOGS : records
    APPLICATIONS ||--o{ SCORING_RESULTS : versions
    USER_INFO }o--|| FNS_MOCK : "inn"
    USER_INFO }o--|| BKI_MOCK : "inn"
    USER_INFO }o--o| REGISTRY_INTERNAL : "inn"

    USERS {
      integer id PK
      string username UK
      string password_hash
      string role
    }
    USER_INFO {
      integer user_id PK,FK
      string inn UK
      string company_name
      integer risk_score
    }
    APPLICATIONS {
      integer global_id PK
      integer local_id
      integer user_id FK
      integer loan_id FK
      string inn
      string status
      number loan_sum
      integer loan_duration
      number loan_interest
      string purpose
      json missing_fields
      number approved_amount
      string decision_reason
    }
    APPLICATIONS_LOGS {
      integer id PK
      integer application_global_id FK
      string new_status
      string comment
      json metadata
      datetime timestamp
    }
    SCORING_RESULTS {
      integer id PK
      integer application_id FK
      integer version
      string trigger
      integer score
      string risk_level
      number default_probability
      json factors
      json reason_codes
      string model_version
    }
    LOANS {
      integer id PK
      string name
      number interest_rate
      integer duration
      integer min_amount
      integer max_amount
    }
```

`global_id` — технический идентификатор общей очереди, `local_id` — последовательный номер внутри одного клиента. Уникальность прикладной ссылки обеспечивается парой `(user_id, local_id)`; E2E и HTTP-коллекция всегда получают оба ID из ответа создания заявки и не предполагают фиксированных значений.

Поля JSON сейчас хранятся как `TEXT` из-за демонстрационной in-memory SQLite. В production-схеме их следует перенести в JSONB и добавить ограничения уникальности `(user_id, local_id)` и `(application_id, version)`.
