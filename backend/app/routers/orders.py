from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import STAFF_ROLES, get_current_user
from app.database import get_db
from app.models import Order, User
from app.schemas import OrderOut
from app.services.order_service import resolve_order_for_user

router = APIRouter(prefix="/api/orders", tags=["Orders"])


@router.get("", response_model=list[OrderOut])
def list_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Order)
    if current_user.role not in STAFF_ROLES:
        query = query.filter(Order.customer_id == current_user.id)
    return query.order_by(Order.created_at.desc()).all()


@router.get("/{order_identifier}", response_model=OrderOut)
def get_order(
    order_identifier: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = resolve_order_for_user(db, order_identifier, current_user)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found or you do not have permission to view it.",
        )
    return order
