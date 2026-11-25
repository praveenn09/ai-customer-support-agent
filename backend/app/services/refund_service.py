from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
import hashlib

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth import STAFF_ROLES
from app.config import settings
from app.models import Order, Refund, Ticket, User
from app.services.audit_service import record_audit_event
from app.services.escalation_service import create_escalation
from app.services.order_service import resolve_order_for_user
from app.services.policy_service import get_category_return_window


@dataclass
class RefundOutcome:
    outcome: str  # approved | escalated | rejected | duplicate_prevented
    message: str
    refund: Refund | None = None
    escalation_id: int | None = None
    duplicate_prevented: bool = False


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _default_idempotency_key(order_id: int, ticket_id: int, amount: Decimal) -> str:
    raw = f"order:{order_id}:ticket:{ticket_id}:amount:{amount}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def process_refund_request(
    db: Session,
    *,
    actor: User,
    order_identifier: str | int,
    ticket: Ticket,
    amount: Decimal,
    reason: str,
    idempotency_key: str | None = None,
) -> RefundOutcome:
    """
    Authoritative backend service for refund eligibility, idempotency, and ₹5,000 escalation rule.
    Never trusts LLM output or client-side checks.
    """
    order = resolve_order_for_user(db, order_identifier, actor)
    if not order:
        return RefundOutcome(
            outcome="rejected",
            message="Order was not found or you do not have permission to access it.",
        )

    if actor.role not in STAFF_ROLES and ticket.customer_id != actor.id:
        return RefundOutcome(
            outcome="rejected",
            message="You do not have permission to request a refund on this ticket.",
        )

    # Link ticket to order if not yet linked
    if ticket.order_id is None:
        ticket.order_id = order.id

    idem_key = (idempotency_key or "").strip() or _default_idempotency_key(order.id, ticket.id, amount)

    # 1. Idempotency check (same key)
    existing_by_key = db.query(Refund).filter(Refund.idempotency_key == idem_key).first()
    if existing_by_key:
        return RefundOutcome(
            outcome="duplicate_prevented",
            message=f"Duplicate refund request prevented. Existing refund #{existing_by_key.id} is '{existing_by_key.status}'.",
            refund=existing_by_key,
            duplicate_prevented=True,
        )

    # 2. Prevent multiple active refunds on the same order
    existing_for_order = (
        db.query(Refund)
        .filter(
            Refund.order_id == order.id,
            Refund.status.in_(["approved", "processed", "pending_review"]),
        )
        .first()
    )
    if existing_for_order:
        return RefundOutcome(
            outcome="duplicate_prevented",
            message=(
                f"A refund (#{existing_for_order.id}) for order {order.order_code} already exists "
                f"with status '{existing_for_order.status}'."
            ),
            refund=existing_for_order,
            duplicate_prevented=True,
        )

    # 3. Validate order status
    if order.status != "delivered" or order.delivery_date is None:
        record_audit_event(
            db,
            actor_id=actor.id,
            actor_role=actor.role,
            event_type="refund_rejected_ineligible",
            entity_type="order",
            entity_id=order.id,
            details=f"Order {order.order_code} status is '{order.status}', not delivered.",
        )
        db.commit()
        return RefundOutcome(
            outcome="rejected",
            message=f"Order {order.order_code} is currently '{order.status}'. Only delivered orders are eligible for a delivery refund.",
        )

    # 4. Validate category return window
    window_days = get_category_return_window(order.category)
    days_since_delivery = (datetime.now(timezone.utc) - _ensure_utc(order.delivery_date)).days

    if window_days == 0:
        record_audit_event(
            db,
            actor_id=actor.id,
            actor_role=actor.role,
            event_type="refund_rejected_non_returnable",
            entity_type="order",
            entity_id=order.id,
            details=f"Category '{order.category}' is non-returnable.",
        )
        db.commit()
        return RefundOutcome(
            outcome="rejected",
            message=(
                f"Items in the '{order.category}' category ({order.item_name}) are non-returnable under our policy. "
                "If the item arrived damaged or spoiled, I can escalate this to human support for review."
            ),
        )

    if days_since_delivery > window_days:
        record_audit_event(
            db,
            actor_id=actor.id,
            actor_role=actor.role,
            event_type="refund_rejected_expired_window",
            entity_type="order",
            entity_id=order.id,
            details=f"Delivered {days_since_delivery} days ago; {order.category} window is {window_days} days.",
        )
        db.commit()
        return RefundOutcome(
            outcome="rejected",
            message=(
                f"The return window for order {order.order_code} ({order.item_name}) has expired. "
                f"It was delivered {days_since_delivery} days ago, and the {order.category} return window is {window_days} days."
            ),
        )

    # 5. Validate refundable amount
    if amount <= Decimal("0") or amount > order.total_amount:
        return RefundOutcome(
            outcome="rejected",
            message=f"Requested amount ₹{amount} is invalid. Maximum refundable amount for {order.order_code} is ₹{order.total_amount}.",
        )

    # 6. Enforce ₹5,000 automated threshold
    limit = Decimal(str(settings.auto_refund_limit_inr))
    if amount > limit:
        refund = Refund(
            order_id=order.id,
            ticket_id=ticket.id,
            amount=amount,
            reason=reason,
            status="pending_review",
            idempotency_key=idem_key,
            requested_by=actor.id,
        )
        db.add(refund)
        db.flush()

        escalation = create_escalation(
            db,
            actor=actor,
            ticket=ticket,
            summary=(
                f"Refund of ₹{amount} for {order.order_code} ({order.item_name}) exceeds ₹{limit} automated limit. "
                f"Delivered {days_since_delivery} days ago ({window_days}-day {order.category} window)."
            ),
            priority="high",
            internal_note=f"Auto-escalated due to ₹{limit} threshold. Reason: {reason}",
        )
        record_audit_event(
            db,
            actor_id=actor.id,
            actor_role=actor.role,
            event_type="refund_escalated",
            entity_type="refund",
            entity_id=refund.id,
            details=f"Refund #{refund.id} (₹{amount}) escalated to human review.",
        )
        db.commit()
        db.refresh(refund)
        return RefundOutcome(
            outcome="escalated",
            message=(
                f"Order {order.order_code} is eligible (delivered {days_since_delivery} days ago, within the {window_days}-day {order.category} window). "
                f"Because the refund amount of ₹{amount} exceeds our ₹{limit} automated approval limit, "
                "I have created a pending refund request and escalated your ticket to a human support specialist for review."
            ),
            refund=refund,
            escalation_id=escalation.id,
        )

    # 7. Eligible & <= ₹5,000 -> create simulated approved refund
    refund = Refund(
        order_id=order.id,
        ticket_id=ticket.id,
        amount=amount,
        reason=reason,
        status="approved",
        idempotency_key=idem_key,
        requested_by=actor.id,
    )
    ticket.status = "resolved"
    db.add(refund)
    db.flush()

    record_audit_event(
        db,
        actor_id=actor.id,
        actor_role=actor.role,
        event_type="refund_approved",
        entity_type="refund",
        entity_id=refund.id,
        details=f"Simulated refund #{refund.id} for ₹{amount} on {order.order_code} approved.",
    )
    db.commit()
    db.refresh(refund)

    return RefundOutcome(
        outcome="approved",
        message=(
            f"Your refund of ₹{amount} for order {order.order_code} ({order.item_name}) has been approved and is processing. "
            f"(Delivered {days_since_delivery} days ago, within the {window_days}-day {order.category} return window.)"
        ),
        refund=refund,
    )


def staff_review_refund(
    db: Session,
    *,
    staff_user: User,
    refund_id: int,
    decision: str,
    review_note: str | None = None,
) -> Refund:
    """Allow support staff to approve or reject a pending refund."""
    refund = db.query(Refund).filter(Refund.id == refund_id).first()
    if not refund:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Refund not found.")
    if refund.status not in {"pending_review"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Refund #{refund.id} is already '{refund.status}' and cannot be reviewed again.",
        )

    refund.status = decision
    refund.reviewed_by = staff_user.id
    refund.review_note = review_note

    ticket = db.query(Ticket).filter(Ticket.id == refund.ticket_id).first()
    if ticket:
        ticket.status = "resolved" if decision == "approved" else "closed"

    record_audit_event(
        db,
        actor_id=staff_user.id,
        actor_role=staff_user.role,
        event_type=f"refund_{decision}",
        entity_type="refund",
        entity_id=refund.id,
        details=review_note or f"Staff {decision} refund #{refund.id} (₹{refund.amount}).",
    )

    db.commit()
    db.refresh(refund)
    return refund
