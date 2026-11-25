# SupportDesk — E-Commerce AI Customer Support & Refund Platform

SupportDesk is a full-stack e-commerce customer support web application built with **React + JavaScript + Tailwind CSS**, **Python + FastAPI**, and **PostgreSQL**. Customers can view orders, raise support tickets, chat with an AI support agent, request refunds, and track resolution. Support staff can filter tickets, inspect order and conversation context, review escalations above ₹5,000, add internal notes, and approve or reject refunds.

---

## Architecture & Key Design Decisions

- **Frontend**: React 18 (plain JavaScript + JSX), Vite, React Router, Tailwind CSS (`frontend/`).
- **Backend**: FastAPI + SQLAlchemy 2.0 + Alembic migrations + Pydantic v2 (`backend/`).
- **Database**: PostgreSQL 16 (`users`, `orders`, `tickets`, `messages`, `refunds`, `escalations`, `audit_logs`).
- **AI Agent & RAG Choice**:
  - **Custom Tool-Calling Agent (`backend/app/services/agent_service.py`)**: Implemented directly in clean, inspectable Python without heavy framework lock-in. It exposes 4 explicit tools:
    1. `get_order_details(order_id)`
    2. `search_return_policy(category)`
    3. `process_refund(order_id, amount, reason)`
    4. `escalate_to_human(ticket_id, summary, priority)`
  - **Local Policy RAG (`backend/app/services/policy_service.py`)**: Uses keyword/section scoring against the inspectable policy document [`backend/policies/return_policy.md`](backend/policies/return_policy.md).
  - **Zero-Cost Local Mode + Optional LLM**: Runs out-of-the-box with `LLM_PROVIDER=local` (deterministic tool-calling agent, no paid API key required), and supports `LLM_PROVIDER=openai_compatible` when an API key is provided in `.env`.
  - **Backend Authority**: Refund eligibility, ownership, category return windows, ₹5,000 automated limit, and idempotency keys are strictly enforced in [`backend/app/services/refund_service.py`](backend/app/services/refund_service.py)—never by the frontend or LLM text alone.

See also:
- Architecture & Agent Flow Diagrams: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Database ER Diagram & Schema: [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md)
- Exported OpenAPI Specification: [`docs/openapi.json`](docs/openapi.json)

---

## Prerequisites

- **Option A (Recommended — Docker)**: Docker & Docker Compose
- **Option B (Local Manual Run)**:
  - Python 3.11+
  - Node.js 20+ and npm
  - PostgreSQL 15+ (running locally or via Docker)

---

## Environment Variables

Copy `.env.example` to `.env` before running locally:

```bash
cp .env.example .env
```

Key variables (all safe local defaults are shown in `.env.example`, with no real secrets committed):
- `DATABASE_URL`: PostgreSQL connection string (e.g. `postgresql+psycopg2://supportdesk:supportdesk_local_pass@localhost:5433/supportdesk`)
- `JWT_SECRET_KEY`: Secret key for signing JWT auth tokens
- `LLM_PROVIDER`: `local` (default) or `openai_compatible`
- `AUTO_REFUND_LIMIT_INR`: `5000` (refunds above ₹5,000 automatically escalate to human review)

---

## Quick Start with Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Services started:
- **Frontend UI**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **Swagger / OpenAPI Docs**: http://localhost:8000/docs
- **PostgreSQL**: `localhost:5433` (mapped from container port `5432` to avoid conflicts with local PostgreSQL)

The backend container automatically runs `alembic upgrade head` and `python -m app.seed` on startup.

---

## Local Development Setup (Without Full Docker Compose)

### 1. Start PostgreSQL
If you have Docker, you can start only PostgreSQL:
```bash
docker compose up -d postgres
```

### 2. Backend Setup, Migrations & Seed Data
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt

# Run Alembic migrations
alembic upgrade head

# Seed demo users, orders, and sample escalated ticket
python -m app.seed

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

---

## Seeded Demo Accounts & Orders

| Role | Email | Password | Notes |
|---|---|---|---|
| Customer | `aarav@example.com` | `Customer@123` | Has 5 seeded orders (`ORD-2381` .. `ORD-2385`) |
| Customer | `priya@example.com` | `Customer@123` | Owns `ORD-9001` (used to test cross-customer isolation) |
| Support Agent | `agent@example.com` | `Staff@123` | Access to Staff Operations Console & Escalations |
| Admin | `admin@example.com` | `Admin@123` | Full staff & audit visibility |

### Seeded Orders for `aarav@example.com`
- `ORD-2381`: Studio Wireless Headphones (Electronics, ₹3,499, delivered 3 days ago) — **Eligible for auto-refund**
- `ORD-2382`: 27-inch 4K IPS Monitor (Electronics, ₹18,999, delivered 4 days ago) — **Exceeds ₹5,000 -> Escalated**
- `ORD-2383`: AeroStride Running Shoes (Footwear, ₹2,499, delivered 25 days ago) — **Return window expired (14 days)**
- `ORD-2384`: Single-Origin Arabica Coffee Beans (Grocery, ₹899, delivered 2 days ago) — **Non-returnable category**
- `ORD-2385`: Compact Mechanical Keyboard (Electronics, ₹2,199, `shipped`) — **Not yet delivered**

---

## Running Automated Tests

```bash
cd backend
pytest tests -v
```

Covered end-to-end & unit scenarios:
1. Customer authentication & role-based access control (blocks unauthenticated & cross-customer access)
2. Ticket creation & conversation history persistence
3. Missing order ID (agent requests clarification without triggering tools/refunds)
4. Eligible refund <= ₹5,000 (creates exactly one approved refund record)
5. Expired return window (rejects refund with clear policy explanation)
6. Refund > ₹5,000 (creates `pending_review` refund + escalation; staff approves via review endpoint)
7. Duplicate refund submission (server-side idempotency key prevents double refunds)
8. Prompt injection attempt (policy, authorization, and thresholds remain enforced + logged)
9. Database / tool failure handling (graceful error message without false success)
