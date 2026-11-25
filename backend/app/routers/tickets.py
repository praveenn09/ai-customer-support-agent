import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.auth import STAFF_ROLES, get_current_user, require_staff
from app.database import get_db
from app.models import Message, Order, Ticket, User
from app.schemas import (
    ChatTurnResponse,
    MessageCreate,
    MessageOut,
    TicketCreate,
    TicketDetailOut,
    TicketOut,
    TicketUpdateStaff,
)
from app.services.agent_service import run_support_agent_turn
from app.services.audit_service import record_audit_event

router = APIRouter(prefix="/api/tickets", tags=["Tickets & Messages"])


def _get_authorized_ticket(db: Session, ticket_id: int, user: User) -> Ticket:
    ticket = (
        db.query(Ticket)
        .options(joinedload(Ticket.customer), joinedload(Ticket.order), joinedload(Ticket.messages))
        .filter(Ticket.id == ticket_id)
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")
    if user.role not in STAFF_ROLES and ticket.customer_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this ticket.",
        )
    return ticket


@router.get("", response_model=list[TicketOut])
def list_tickets(
    status_filter: str | None = Query(default=None, alias="status"),
    priority: str | None = Query(default=None),
    search: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Ticket).options(joinedload(Ticket.customer), joinedload(Ticket.order))
    if current_user.role not in STAFF_ROLES:
        query = query.filter(Ticket.customer_id == current_user.id)

    if status_filter:
        query = query.filter(Ticket.status == status_filter)
    if priority:
        query = query.filter(Ticket.priority == priority)
    if search:
        like = f"%{search.strip()}%"
        query = query.filter(or_(Ticket.subject.ilike(like), Ticket.description.ilike(like)))

    return query.order_by(Ticket.updated_at.desc()).all()


@router.post("", response_model=TicketDetailOut, status_code=status.HTTP_201_CREATED)
def create_ticket(
    payload: TicketCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order_id = payload.order_id
    if order_id is not None:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order or (current_user.role not in STAFF_ROLES and order.customer_id != current_user.id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected order was not found on your account.",
            )

    ticket = Ticket(
        customer_id=current_user.id,
        order_id=order_id,
        subject=payload.subject.strip(),
        description=payload.description.strip(),
        category=payload.category,
        priority=payload.priority,
        status="open",
    )
    db.add(ticket)
    db.flush()

    initial_msg = Message(
        ticket_id=ticket.id,
        sender_type="customer",
        sender_id=current_user.id,
        content=payload.description.strip(),
    )
    db.add(initial_msg)
    db.flush()

    # Trigger initial AI response so the customer gets immediate guidance
    agent_result = run_support_agent_turn(
        db,
        customer=current_user,
        ticket=ticket,
        history=[],
        user_message=payload.description.strip(),
    )
    agent_msg = Message(
        ticket_id=ticket.id,
        sender_type="ai_agent",
        sender_id=None,
        content=agent_result.reply,
        meta_json=json.dumps({
            "tools_used": agent_result.tools_used,
            "badge": agent_result.badge,
            "badge_tone": agent_result.badge_tone,
        }),
    )
    db.add(agent_msg)

    record_audit_event(
        db,
        actor_id=current_user.id,
        actor_role=current_user.role,
        event_type="ticket_created",
        entity_type="ticket",
        entity_id=ticket.id,
        details=f"Created ticket '{ticket.subject}' ({ticket.category}).",
    )
    db.commit()

    return _get_authorized_ticket(db, ticket.id, current_user)


@router.get("/{ticket_id}", response_model=TicketDetailOut)
def get_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_authorized_ticket(db, ticket_id, current_user)


@router.patch("/{ticket_id}", response_model=TicketOut)
def update_ticket_staff(
    ticket_id: int,
    payload: TicketUpdateStaff,
    staff_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")

    if payload.status:
        ticket.status = payload.status
    if payload.priority:
        ticket.priority = payload.priority

    record_audit_event(
        db,
        actor_id=staff_user.id,
        actor_role=staff_user.role,
        event_type="ticket_updated",
        entity_type="ticket",
        entity_id=ticket.id,
        details=f"Updated ticket status={ticket.status}, priority={ticket.priority}.",
    )
    db.commit()
    return _get_authorized_ticket(db, ticket.id, staff_user)


@router.get("/{ticket_id}/messages", response_model=list[MessageOut])
def list_messages(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = _get_authorized_ticket(db, ticket_id, current_user)
    return ticket.messages


@router.post("/{ticket_id}/messages", response_model=ChatTurnResponse, status_code=status.HTTP_201_CREATED)
def post_message(
    ticket_id: int,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = _get_authorized_ticket(db, ticket_id, current_user)

    if current_user.role in STAFF_ROLES:
        staff_msg = Message(
            ticket_id=ticket.id,
            sender_type="staff",
            sender_id=current_user.id,
            content=payload.content.strip(),
        )
        db.add(staff_msg)
        if ticket.status == "open":
            ticket.status = "in_progress"
        db.commit()
        db.refresh(staff_msg)
        return ChatTurnResponse(
            customer_message=staff_msg,
            agent_message=staff_msg,
            ticket_status=ticket.status,
            tools_used=[],
        )

    history = list(ticket.messages)
    customer_msg = Message(
        ticket_id=ticket.id,
        sender_type="customer",
        sender_id=current_user.id,
        content=payload.content.strip(),
    )
    db.add(customer_msg)
    db.commit()
    db.refresh(customer_msg)

    agent_result = run_support_agent_turn(
        db,
        customer=current_user,
        ticket=ticket,
        history=history,
        user_message=payload.content.strip(),
    )
    agent_msg = Message(
        ticket_id=ticket.id,
        sender_type="ai_agent",
        sender_id=None,
        content=agent_result.reply,
        meta_json=json.dumps({
            "tools_used": agent_result.tools_used,
            "badge": agent_result.badge,
            "badge_tone": agent_result.badge_tone,
        }),
    )
    db.add(agent_msg)
    db.commit()
    db.refresh(agent_msg)

    return ChatTurnResponse(
        customer_message=customer_msg,
        agent_message=agent_msg,
        ticket_status=ticket.status,
        tools_used=agent_result.tools_used,
    )
