from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.auth import STAFF_ROLES, get_current_user, require_staff
from app.database import get_db
from app.models import Refund, Ticket, User
from app.schemas import RefundCreate, RefundOut, RefundReview
from app.services.refund_service import process_refund_request, staff_review_refund

router = APIRouter(prefix="/api/refunds", tags=["Refunds"])


class RefundActionResponse(BaseModel):
    outcome: str
    message: str
    duplicate_prevented: bool = False
    refund: RefundOut | None = None
    escalation_id: int | None = None


@router.get("", response_model=list[RefundOut])
def list_refunds(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Refund).options(joinedload(Refund.order))
    if current_user.role not in STAFF_ROLES:
        query = query.filter(Refund.requested_by == current_user.id)
    return query.order_by(Refund.created_at.desc()).all()


@router.post("", response_model=RefundActionResponse, status_code=status.HTTP_201_CREATED)
def create_refund(
    payload: RefundCreate,
    idempotency_header: str | None = Header(default=None, alias="Idempotency-Key"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.id == payload.ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")
    if current_user.role not in STAFF_ROLES and ticket.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this ticket.")

    idem_key = payload.idempotency_key or idempotency_header
    result = process_refund_request(
        db,
        actor=current_user,
        order_identifier=payload.order_id,
        ticket=ticket,
        amount=payload.amount,
        reason=payload.reason,
        idempotency_key=idem_key,
    )

    if result.outcome == "rejected" and result.refund is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result.message)

    return RefundActionResponse(
        outcome=result.outcome,
        message=result.message,
        duplicate_prevented=result.duplicate_prevented,
        refund=RefundOut.model_validate(result.refund) if result.refund else None,
        escalation_id=result.escalation_id,
    )


@router.post("/{refund_id}/review", response_model=RefundOut)
def review_refund(
    refund_id: int,
    payload: RefundReview,
    staff_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    return staff_review_refund(
        db,
        staff_user=staff_user,
        refund_id=refund_id,
        decision=payload.decision,
        review_note=payload.review_note,
    )
