from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Escalation, Message, Refund, Ticket, User
from app.services.audit_service import record_audit_event


def create_escalation(
    db: Session,
    *,
    actor: User,
    ticket: Ticket,
    summary: str,
    priority: str = "high",
    internal_note: str | None = None,
) -> Escalation:
    """Create a human escalation for a ticket (idempotent for open pending escalations)."""
    existing_pending = (
        db.query(Escalation)
        .filter(Escalation.ticket_id == ticket.id, Escalation.decision == "pending")
        .first()
    )
    if existing_pending:
        return existing_pending

    escalation = Escalation(
        ticket_id=ticket.id,
        summary=summary,
        priority=priority,
        decision="pending",
        internal_note=internal_note,
    )
    ticket.status = "escalated"
    if priority in {"high", "urgent"}:
        ticket.priority = priority

    db.add(escalation)
    db.flush()

    record_audit_event(
        db,
        actor_id=actor.id,
        actor_role=actor.role,
        event_type="escalation_created",
        entity_type="escalation",
        entity_id=escalation.id,
        details=f"Ticket #{ticket.id} escalated ({priority}): {summary[:200]}",
    )
    return escalation


def review_escalation(
    db: Session,
    *,
    staff_user: User,
    escalation_id: int,
    decision: str,
    internal_note: str | None = None,
    approve_pending_refund: bool = False,
) -> Escalation:
    """Allow authorized support staff to approve, reject, or request more info on an escalation."""
    escalation = db.query(Escalation).filter(Escalation.id == escalation_id).first()
    if not escalation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Escalation not found.")

    ticket = db.query(Ticket).filter(Ticket.id == escalation.ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Linked ticket not found.")

    escalation.decision = decision
    escalation.assigned_to = staff_user.id
    if internal_note:
        escalation.internal_note = internal_note

    if decision == "approved":
        ticket.status = "resolved"
        if approve_pending_refund:
            pending_refunds = (
                db.query(Refund)
                .filter(Refund.ticket_id == ticket.id, Refund.status == "pending_review")
                .all()
            )
            for refund in pending_refunds:
                refund.status = "approved"
                refund.reviewed_by = staff_user.id
                refund.review_note = internal_note or "Approved via escalation review."
                record_audit_event(
                    db,
                    actor_id=staff_user.id,
                    actor_role=staff_user.role,
                    event_type="refund_approved",
                    entity_type="refund",
                    entity_id=refund.id,
                    details=f"Approved ₹{refund.amount} refund via escalation #{escalation.id}.",
                )
        db.add(
            Message(
                ticket_id=ticket.id,
                sender_type="staff",
                sender_id=staff_user.id,
                content="Your escalated case has been reviewed and approved by Support Staff."
                + (" Refund has been approved for processing." if approve_pending_refund else ""),
            )
        )
    elif decision == "rejected":
        ticket.status = "closed"
        pending_refunds = (
            db.query(Refund)
            .filter(Refund.ticket_id == ticket.id, Refund.status == "pending_review")
            .all()
        )
        for refund in pending_refunds:
            refund.status = "rejected"
            refund.reviewed_by = staff_user.id
            refund.review_note = internal_note or "Rejected via escalation review."
            record_audit_event(
                db,
                actor_id=staff_user.id,
                actor_role=staff_user.role,
                event_type="refund_rejected",
                entity_type="refund",
                entity_id=refund.id,
                details=f"Rejected refund #{refund.id} via escalation #{escalation.id}.",
            )
        db.add(
            Message(
                ticket_id=ticket.id,
                sender_type="staff",
                sender_id=staff_user.id,
                content="Support Staff reviewed your escalated request and could not approve it under our policy."
                + (f" Note: {internal_note}" if internal_note else ""),
            )
        )
    elif decision == "more_info_requested":
        ticket.status = "waiting_for_customer"
        db.add(
            Message(
                ticket_id=ticket.id,
                sender_type="staff",
                sender_id=staff_user.id,
                content="Support Staff reviewed your escalation and requested additional details before proceeding."
                + (f" Details requested: {internal_note}" if internal_note else ""),
            )
        )

    record_audit_event(
        db,
        actor_id=staff_user.id,
        actor_role=staff_user.role,
        event_type=f"escalation_{decision}",
        entity_type="escalation",
        entity_id=escalation.id,
        details=internal_note or f"Escalation decision set to {decision}.",
    )

    db.commit()
    db.refresh(escalation)
    return escalation
