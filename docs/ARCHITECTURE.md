# SupportDesk Architecture

## System Overview

SupportDesk separates conversational AI assistance from authoritative backend enforcement. The React frontend communicates exclusively with FastAPI REST endpoints protected by JWT authentication and role-based authorization (`customer` vs `agent`/`admin`). All business rules (ownership, delivery status, category return windows, ₹5,000 automated refund threshold, and idempotency keys) are enforced inside backend Python services backed by PostgreSQL.

```mermaid
flowchart LR
    U[Customer / Staff Browser] -->|React + Tailwind| FE[Frontend SPA]
    FE -->|REST JSON + JWT| API[FastAPI Backend]

    subgraph Backend Services
        API --> AUTH[Auth & RBAC]
        API --> ORD[Order Service]
        API --> TICKET[Ticket & Chat Router]
        TICKET --> AGENT[AI Support Agent]
        AGENT -->|Guardrails| INJ[Prompt Injection Filter]
        AGENT -->|Tool 1| T1[get_order_details]
        AGENT -->|Tool 2| T2[search_return_policy]
        AGENT -->|Tool 3| T3[process_refund]
        AGENT -->|Tool 4| T4[escalate_to_human]
        T2 --> RAG[Local Policy RAG: return_policy.md]
        T3 --> REF[Refund Service - Authoritative Rules]
        T4 --> ESC[Escalation Service]
        REF -->|> ₹5,000| ESC
        REF --> AUD[Audit Service]
        ESC --> AUD
    end

    REF --> DB[(PostgreSQL)]
    ORD --> DB
    ESC --> DB
    AUD --> DB
    TICKET --> DB
```

## AI Agent & Human Review Flow

```mermaid
sequenceDiagram
    participant C as Customer
    participant API as FastAPI Ticket Chat
    participant AI as AI Support Agent
    participant POL as Policy RAG
    participant REF as Refund Service
    participant DB as PostgreSQL
    participant S as Support Staff

    C->>API: Send message ("Refund my order")
    API->>AI: Run turn with ticket history
    AI->>AI: Check prompt injection & order ID
    alt Missing Order ID
        AI-->>C: Ask for order ID (no tool executed)
    else Order ID Provided
        AI->>DB: get_order_details(order_id, customer_id)
        AI->>POL: search_return_policy(category)
        AI->>REF: process_refund(order_id, amount, reason)
        alt Expired / Ineligible
            REF-->>AI: Rejected + clear policy reason
        else Eligible & <= ₹5,000
            REF->>DB: Create Refund (approved) + AuditLog
            REF-->>AI: Refund approved
        else Eligible & > ₹5,000
            REF->>DB: Create Refund (pending_review) + Escalation + AuditLog
            REF-->>AI: Escalated for human review
            S->>API: Review escalation (Approve / Reject / Request Info)
            API->>DB: Update Escalation, Refund, Ticket & AuditLog
        end
    end
```
