# SupportDesk Database Schema & ER Diagram

All persistent entities live in PostgreSQL, managed with Alembic migrations (`backend/alembic/versions/0001_initial_schema.py`) and SQLAlchemy 2.0 ORM models (`backend/app/models.py`).

## Entity-Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ ORDERS : places
    USERS ||--o{ TICKETS : raises
    ORDERS ||--o{ TICKETS : "linked_to (optional)"
    TICKETS ||--o{ MESSAGES : contains
    ORDERS ||--o{ REFUNDS : has
    TICKETS ||--o{ REFUNDS : triggers
    TICKETS ||--o{ ESCALATIONS : escalates_to
    USERS ||--o{ AUDIT_LOGS : performs

    USERS {
        int id PK
        string name
        string email UK
        string password_hash
        string role
        datetime created_at
    }
    ORDERS {
        int id PK
        string order_code UK
        int customer_id FK
        string status
        datetime delivery_date
        decimal total_amount
        string item_name
        string category
        datetime created_at
    }
    TICKETS {
        int id PK
        int customer_id FK
        int order_id FK
        string subject
        text description
        string category
        string status
        string priority
        datetime created_at
        datetime updated_at
    }
    MESSAGES {
        int id PK
        int ticket_id FK
        string sender_type
        int sender_id FK
        text content
        text meta_json
        datetime created_at
    }
    REFUNDS {
        int id PK
        int order_id FK
        int ticket_id FK
        decimal amount
        text reason
        string status
        string idempotency_key UK
        int requested_by FK
        int reviewed_by FK
        text review_note
        datetime created_at
        datetime updated_at
    }
    ESCALATIONS {
        int id PK
        int ticket_id FK
        text summary
        string priority
        int assigned_to FK
        string decision
        text internal_note
        datetime created_at
        datetime updated_at
    }
    AUDIT_LOGS {
        int id PK
        int actor_id FK
        string actor_role
        string event_type
        string entity_type
        string entity_id
        text details
        datetime created_at
    }
```

## Key Indexes & Constraints
- `users.email` (Unique Index): Prevents duplicate account registration.
- `orders.order_code` (Unique Index) & `orders.customer_id` (FK -> `users.id`): Fast customer-scoped lookups.
- `tickets.(status, priority)` (Composite Index): Fast filtering in the internal support dashboard.
- `refunds.idempotency_key` (Unique Index): Server-side guarantee against duplicate refund submissions.
- `audit_logs.(event_type, created_at)`: Fast chronological inspection of security and refund events.
