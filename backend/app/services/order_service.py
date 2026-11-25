from sqlalchemy.orm import Session

from app.auth import STAFF_ROLES
from app.models import Order, User


def resolve_order_for_user(db: Session, order_identifier: str | int, user: User) -> Order | None:
    """
    Look up an order by numeric ID or order_code (e.g. 'ORD-2381').
    Enforces customer ownership so customers can never read another customer's order.
    """
    raw = str(order_identifier).strip().lstrip("#")
    query = db.query(Order)

    if raw.isdigit():
        order = query.filter(Order.id == int(raw)).first()
    else:
        order = query.filter(Order.order_code.ilike(raw)).first()

    if not order:
        return None

    if user.role not in STAFF_ROLES and order.customer_id != user.id:
        return None

    return order
