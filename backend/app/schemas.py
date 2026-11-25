from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# --- Auth & Users ---
class UserRegister(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# --- Orders ---
class OrderOut(BaseModel):
    id: int
    order_code: str
    customer_id: int
    status: str
    delivery_date: Optional[datetime]
    total_amount: Decimal
    item_name: str
    category: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Messages ---
class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class MessageOut(BaseModel):
    id: int
    ticket_id: int
    sender_type: str
    sender_id: Optional[int]
    content: str
    meta_json: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Tickets ---
class TicketCreate(BaseModel):
    subject: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=5, max_length=4000)
    category: Literal["refund", "order_issue", "damaged_item", "delivery", "general"] = "general"
    priority: Literal["low", "medium", "high", "urgent"] = "medium"
    order_id: Optional[int] = None


class TicketUpdateStaff(BaseModel):
    status: Optional[Literal["open", "in_progress", "escalated", "waiting_for_customer", "resolved", "closed"]] = None
    priority: Optional[Literal["low", "medium", "high", "urgent"]] = None


class TicketOut(BaseModel):
    id: int
    customer_id: int
    order_id: Optional[int]
    subject: str
    description: str
    category: str
    status: str
    priority: str
    created_at: datetime
    updated_at: datetime
    customer: Optional[UserOut] = None
    order: Optional[OrderOut] = None

    model_config = ConfigDict(from_attributes=True)


class TicketDetailOut(TicketOut):
    messages: list[MessageOut] = []


class ChatTurnResponse(BaseModel):
    customer_message: MessageOut
    agent_message: MessageOut
    ticket_status: str
    tools_used: list[str] = []


# --- Refunds ---
class RefundCreate(BaseModel):
    order_id: int
    ticket_id: int
    amount: Decimal = Field(gt=0)
    reason: str = Field(min_length=3, max_length=1000)
    idempotency_key: Optional[str] = Field(default=None, max_length=128)


class RefundReview(BaseModel):
    decision: Literal["approved", "rejected"]
    review_note: Optional[str] = Field(default=None, max_length=1000)


class RefundOut(BaseModel):
    id: int
    order_id: int
    ticket_id: int
    amount: Decimal
    reason: str
    status: str
    idempotency_key: str
    requested_by: int
    reviewed_by: Optional[int]
    review_note: Optional[str]
    created_at: datetime
    updated_at: datetime
    order: Optional[OrderOut] = None

    model_config = ConfigDict(from_attributes=True)


# --- Escalations ---
class EscalationCreate(BaseModel):
    ticket_id: int
    summary: str = Field(min_length=5, max_length=2000)
    priority: Literal["low", "medium", "high", "urgent"] = "high"
    internal_note: Optional[str] = Field(default=None, max_length=2000)


class EscalationReview(BaseModel):
    decision: Literal["approved", "rejected", "more_info_requested"]
    internal_note: Optional[str] = Field(default=None, max_length=2000)
    approve_pending_refund: bool = False


class EscalationOut(BaseModel):
    id: int
    ticket_id: int
    summary: str
    priority: str
    assigned_to: Optional[int]
    decision: str
    internal_note: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EscalationNoteCreate(BaseModel):
    internal_note: str = Field(min_length=2, max_length=2000)


# --- Audit Logs ---
class AuditLogOut(BaseModel):
    id: int
    actor_id: Optional[int]
    actor_role: str
    event_type: str
    entity_type: str
    entity_id: str
    details: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
