from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import require_staff
from app.database import get_db
from app.models import AuditLog, Escalation, Ticket, User
from app.schemas import (
    AuditLogOut,
    EscalationCreate,
    EscalationNoteCreate,
    EscalationOut,
    EscalationReview,
)
from app.services.audit_service import record_audit_event
from app.services.escalation_service import create_escalation, review_escalation

router = APIRouter(tags=["Escalations & Audit"])


@router.get("/api/escalations", response_model=list[EscalationOut])
def list_escalations(
    decision: str | None = None,
    staff_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    query = db.query(Escalation)
    if decision:
        query = query.filter(Escalation.decision == decision)
    return query.order_by(Escalation.created_at.desc()).all()


@router.post("/api/escalations", response_model=EscalationOut, status_code=status.HTTP_201_CREATED)
def create_manual_escalation(
    payload: EscalationCreate,
    staff_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.id == payload.ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")
    esc = create_escalation(
        db,
        actor=staff_user,
        ticket=ticket,
        summary=payload.summary,
        priority=payload.priority,
        internal_note=payload.internal_note,
    )
    db.commit()
    db.refresh(esc)
    return esc


@router.post("/api/escalations/{escalation_id}/review", response_model=EscalationOut)
def review_escalation_endpoint(
    escalation_id: int,
    payload: EscalationReview,
    staff_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    return review_escalation(
        db,
        staff_user=staff_user,
        escalation_id=escalation_id,
        decision=payload.decision,
        internal_note=payload.internal_note,
        approve_pending_refund=payload.approve_pending_refund,
    )


@router.post("/api/escalations/{escalation_id}/notes", response_model=EscalationOut)
def add_internal_note(
    escalation_id: int,
    payload: EscalationNoteCreate,
    staff_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    escalation = db.query(Escalation).filter(Escalation.id == escalation_id).first()
    if not escalation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Escalation not found.")

    existing = (escalation.internal_note or "").strip()
    new_line = f"[{staff_user.name}]: {payload.internal_note.strip()}"
    escalation.internal_note = f"{existing}\n{new_line}".strip() if existing else new_line

    record_audit_event(
        db,
        actor_id=staff_user.id,
        actor_role=staff_user.role,
        event_type="escalation_note_added",
        entity_type="escalation",
        entity_id=escalation.id,
        details="Staff added internal note.",
    )
    db.commit()
    db.refresh(escalation)
    return escalation


@router.get("/api/audit-logs", response_model=list[AuditLogOut])
def list_audit_logs(
    limit: int = 50,
    staff_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    return db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(min(limit, 200)).all()
