from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.models import AuditLog, Escalation, Message, Order, Refund, Ticket, User


def seed_database(db: Session) -> dict:
    """Populate deterministic demo users, orders, tickets, and sample conversation."""
    existing = db.query(User).filter(User.email == "aarav@example.com").first()
    if existing:
        return {"seeded": False, "message": "Seed data already exists."}

    now = datetime.now(timezone.utc)

    customer1 = User(
        name="Aarav Sharma",
        email="aarav@example.com",
        password_hash=hash_password("Customer@123"),
        role="customer",
    )
    
    customer2 = User(
        name="Priya Nair",
        email="priya@example.com",
        password_hash=hash_password("Customer@123"),
        role="customer",
    )
    agent = User(
        name="Meera Patel",
        email="agent@example.com",
        password_hash=hash_password("Staff@123"),
        role="agent",
    )
    admin = User(
        name="Vikram Rao",
        email="admin@example.com",
        password_hash=hash_password("Admin@123"),
        role="admin",
    )
    db.add_all([customer1, customer2, agent, admin])
    db.flush()

    orders = [
        Order(
            order_code="ORD-2381",
            customer_id=customer1.id,
            status="delivered",
            delivery_date=now - timedelta(days=3),
            total_amount=Decimal("3499.00"),
            item_name="Studio Wireless Headphones",
            category="Electronics",
            created_at=now - timedelta(days=6),
        ),
        Order(
            order_code="ORD-2382",
            customer_id=customer1.id,
            status="delivered",
            delivery_date=now - timedelta(days=4),
            total_amount=Decimal("18999.00"),
            item_name="27-inch 4K IPS Monitor",
            category="Electronics",
            created_at=now - timedelta(days=8),
        ),
        Order(
            order_code="ORD-2383",
            customer_id=customer1.id,
            status="delivered",
            delivery_date=now - timedelta(days=25),
            total_amount=Decimal("2499.00"),
            item_name="AeroStride Running Shoes",
            category="Footwear",
            created_at=now - timedelta(days=29),
        ),
        Order(
            order_code="ORD-2384",
            customer_id=customer1.id,
            status="delivered",
            delivery_date=now - timedelta(days=2),
            total_amount=Decimal("899.00"),
            item_name="Single-Origin Arabica Coffee Beans",
            category="Grocery",
            created_at=now - timedelta(days=5),
        ),
        Order(
            order_code="ORD-2385",
            customer_id=customer1.id,
            status="shipped",
            delivery_date=None,
            total_amount=Decimal("2199.00"),
            item_name="Compact Mechanical Keyboard",
            category="Electronics",
            created_at=now - timedelta(days=2),
        ),
        Order(
            order_code="ORD-9001",
            customer_id=customer2.id,
            status="delivered",
            delivery_date=now - timedelta(days=2),
            total_amount=Decimal("4299.00"),
            item_name="Noise-Cancelling Earbuds",
            category="Electronics",
            created_at=now - timedelta(days=4),
        ),
    ]
    db.add_all(orders)
    db.flush()

    # Sample open ticket so both dashboards look alive on first login
    ticket1 = Ticket(
        customer_id=customer1.id,
        order_id=orders[1].id,
        subject="Monitor arrived with backlight bleed",
        description="My 27-inch 4K IPS Monitor (ORD-2382) has severe backlight bleed on the left corner. I want a full refund.",
        category="damaged_item",
        status="escalated",
        priority="high",
        created_at=now - timedelta(hours=3),
        updated_at=now - timedelta(hours=2),
    )
    db.add(ticket1)
    db.flush()

    db.add_all([
        Message(
            ticket_id=ticket1.id,
            sender_type="customer",
            sender_id=customer1.id,
            content="My 27-inch 4K IPS Monitor (ORD-2382) has severe backlight bleed. Can I get a refund of ₹18,999?",
            created_at=now - timedelta(hours=3),
        ),
        Message(
            ticket_id=ticket1.id,
            sender_type="ai_agent",
            sender_id=None,
            content=(
                "I verified order ORD-2382 (27-inch 4K IPS Monitor, delivered 4 days ago, within the 10-day Electronics return window). "
                "Because the requested refund of ₹18,999.00 exceeds our ₹5,000 automated limit, I have escalated your case to a human support specialist for review."
            ),
            meta_json='{"tools_used": ["get_order_details", "search_return_policy", "escalate_to_human"], "badge": "Escalated for human review"}',
            created_at=now - timedelta(hours=2, minutes=58),
        ),
    ])

    pending_refund = Refund(
        order_id=orders[1].id,
        ticket_id=ticket1.id,
        amount=Decimal("18999.00"),
        reason="Severe backlight bleed on left corner",
        status="pending_review",
        idempotency_key=f"seed-refund-order-{orders[1].id}",
        requested_by=customer1.id,
    )
    escalation1 = Escalation(
        ticket_id=ticket1.id,
        summary="Refund of ₹18,999.00 for ORD-2382 exceeds ₹5,000 automated limit. Order delivered 4 days ago (eligible window).",
        priority="high",
        assigned_to=agent.id,
        decision="pending",
        internal_note="Awaiting staff verification of high-value Electronics return.",
    )
    audit1 = AuditLog(
        actor_id=customer1.id,
        actor_role="customer",
        event_type="refund_escalated",
        entity_type="ticket",
        entity_id=str(ticket1.id),
        details="Seeded high-value refund escalation for ORD-2382 (₹18,999.00).",
    )
    db.add_all([pending_refund, escalation1, audit1])
    db.commit()
    return {"seeded": True, "message": "Seeded demo users, orders, and sample escalated ticket."}


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        result = seed_database(db)
        print(result["message"])
    finally:
        db.close()
