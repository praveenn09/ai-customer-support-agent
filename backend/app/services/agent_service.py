from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import json
import re
from typing import Any

from openai import OpenAI
from sqlalchemy.orm import Session

from app.config import settings
from app.logging_config import get_logger
from app.models import Message, Order, Ticket, User
from app.services.audit_service import record_audit_event
from app.services.escalation_service import create_escalation
from app.services.order_service import resolve_order_for_user
from app.services.policy_service import get_category_return_window, search_return_policy
from app.services.refund_service import process_refund_request

logger = get_logger("supportdesk.agent")

INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions",
    r"override\s+(the\s+)?(policy|rules|limit|threshold|system)",
    r"bypass\s+(the\s+)?(policy|check|validation|limit|auth)",
    r"reveal\s+(the\s+)?system\s+prompt",
    r"developer\s+mode",
    r"jailbreak",
    r"approve\s+(my\s+)?refund\s+anyway",
    r"force\s+(the\s+)?refund",
    r"skip\s+(all\s+)?checks",
    r"act\s+as\s+(an\s+)?admin",
]

ORDER_CODE_RE = re.compile(r"\bORD[-_ ]?(\d{3,6})\b", re.IGNORECASE)
AMOUNT_RE = re.compile(r"(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)", re.IGNORECASE)

REFUND_KEYWORDS = {"refund", "money back", "damaged", "broken", "cracked", "defective", "replace", "return my", "return order"}
ESCALATE_KEYWORDS = {"human", "manager", "supervisor", "escalate", "real person", "speak to agent"}
ORDER_KEYWORDS = {"order", "status", "delivered", "delivery", "track", "package", "item"}
POLICY_KEYWORDS = {"policy", "window", "days", "eligible", "returnable", "return policy", "electronics", "footwear", "apparel", "grocery"}

OFF_TOPIC_PATTERNS = [
    r"\bleetcode\b",
    r"\btwo\s+sum\b",
    r"\bcode\b",
    r"\bpython\b",
    r"\bjavascript\b",
    r"\bjava\b",
    r"\bc\+\+\b",
    r"\balgorithm\b",
    r"\bdata\s+structure\b",
    r"\bsql\s+query\b",
    r"\bwrite\s+(a\s+)?(program|script|function|essay|poem|story)\b",
    r"\bsolve\s+(this|the)\s+(problem|equation|puzzle)\b",
    r"\brecipe\b",
    r"\bweather\b",
]


@dataclass
class AgentResult:
    reply: str
    tools_used: list[str] = field(default_factory=list)
    badge: str | None = None
    badge_tone: str = "neutral"  # neutral | success | warning | danger


def _is_prompt_injection(text: str) -> bool:
    lowered = text.lower()
    return any(re.search(pattern, lowered) for pattern in INJECTION_PATTERNS)


def _is_off_topic(text: str) -> bool:
    lowered = (text or "").lower()
    has_support_signal = (
        bool(_extract_order_code(text))
        or any(k in lowered for k in REFUND_KEYWORDS | ESCALATE_KEYWORDS | ORDER_KEYWORDS | POLICY_KEYWORDS)
        or "ticket" in lowered
    )
    if has_support_signal:
        return False
    return any(re.search(pattern, lowered) for pattern in OFF_TOPIC_PATTERNS)


def _extract_order_code(text: str) -> str | None:
    match = ORDER_CODE_RE.search(text or "")
    if match:
        return f"ORD-{match.group(1)}"
    return None


def _extract_amount(text: str) -> Decimal | None:
    match = AMOUNT_RE.search(text or "")
    if not match:
        return None
    cleaned = match.group(1).replace(",", "")
    try:
        val = Decimal(cleaned)
        return val if val > 0 else None
    except InvalidOperation:
        return None


class SupportAgentTools:
    """Bounded toolset exposed to the AI Customer Support Agent."""

    def __init__(self, db: Session, customer: User, ticket: Ticket):
        self.db = db
        self.customer = customer
        self.ticket = ticket
        self.tools_used: list[str] = []
        self.badge: str | None = None
        self.badge_tone: str = "neutral"

    def get_order_details(self, order_id: str | int) -> dict[str, Any]:
        self.tools_used.append("get_order_details")
        order = resolve_order_for_user(self.db, order_id, self.customer)
        if not order:
            return {
                "found": False,
                "error": "Order not found or not accessible for this customer account.",
            }
        if self.ticket.order_id is None:
            self.ticket.order_id = order.id
            self.db.flush()

        days_since = None
        if order.delivery_date:
            dt = order.delivery_date
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            days_since = (datetime.now(timezone.utc) - dt).days

        return {
            "found": True,
            "order_id": order.id,
            "order_code": order.order_code,
            "status": order.status,
            "delivery_date": order.delivery_date.isoformat() if order.delivery_date else None,
            "days_since_delivery": days_since,
            "item_name": order.item_name,
            "category": order.category,
            "total_amount": float(order.total_amount),
        }

    def search_return_policy(self, category: str) -> dict[str, Any]:
        self.tools_used.append("search_return_policy")
        return search_return_policy(category)

    def process_refund(self, order_id: str | int, amount: float | Decimal, reason: str) -> dict[str, Any]:
        self.tools_used.append("process_refund")
        outcome = process_refund_request(
            self.db,
            actor=self.customer,
            order_identifier=order_id,
            ticket=self.ticket,
            amount=Decimal(str(amount)),
            reason=reason or self.ticket.subject,
        )
        if outcome.outcome == "approved":
            self.badge = "Refund approved • Processing"
            self.badge_tone = "success"
        elif outcome.outcome == "escalated":
            self.badge = "Escalated for human review"
            self.badge_tone = "warning"
        elif outcome.outcome == "duplicate_prevented":
            self.badge = "Duplicate refund prevented"
            self.badge_tone = "neutral"
        else:
            self.badge = "Not eligible under policy"
            self.badge_tone = "danger"

        return {
            "outcome": outcome.outcome,
            "message": outcome.message,
            "duplicate_prevented": outcome.duplicate_prevented,
            "refund_id": outcome.refund.id if outcome.refund else None,
            "refund_status": outcome.refund.status if outcome.refund else None,
            "escalation_id": outcome.escalation_id,
        }

    def escalate_to_human(self, ticket_id: int, summary: str, priority: str = "high") -> dict[str, Any]:
        self.tools_used.append("escalate_to_human")
        esc = create_escalation(
            self.db,
            actor=self.customer,
            ticket=self.ticket,
            summary=summary,
            priority=priority if priority in {"low", "medium", "high", "urgent"} else "high",
        )
        self.db.commit()
        self.badge = "Escalated for human review"
        self.badge_tone = "warning"
        return {
            "escalated": True,
            "escalation_id": esc.id,
            "ticket_status": self.ticket.status,
        }


def _find_context_order_identifier(ticket: Ticket, history: list[Message], current_text: str) -> str | int | None:
    """Recover an order identifier from current message, ticket link, or prior turns."""
    from_current = _extract_order_code(current_text)
    if from_current:
        return from_current
    if ticket.order_id is not None:
        return ticket.order_id
    for msg in reversed(history):
        code = _extract_order_code(msg.content)
        if code:
            return code
    code_desc = _extract_order_code(ticket.description)
    if code_desc:
        return code_desc
    return None


def _run_local_agent(
    db: Session,
    customer: User,
    ticket: Ticket,
    history: list[Message],
    user_message: str,
) -> AgentResult:
    tools = SupportAgentTools(db, customer, ticket)
    lowered = user_message.lower()
    combined_context = " ".join([ticket.subject, ticket.description] + [m.content for m in history] + [user_message]).lower()

    wants_refund = any(k in lowered for k in REFUND_KEYWORDS) or (
        ticket.category in {"refund", "damaged_item"} and any(w in lowered for w in {"yes", "please", "proceed", "ord-"})
    )
    wants_escalation = any(k in lowered for k in ESCALATE_KEYWORDS)
    wants_order_info = any(k in lowered for k in ORDER_KEYWORDS)
    wants_policy = any(k in lowered for k in POLICY_KEYWORDS)

    order_identifier = _find_context_order_identifier(ticket, history, user_message)

    # 1. Explicit escalation request
    if wants_escalation and not wants_refund:
        res = tools.escalate_to_human(
            ticket.id,
            summary=f"Customer requested human support on ticket #{ticket.id}: {user_message[:250]}",
            priority="high",
        )
        return AgentResult(
            reply=(
                f"I have escalated your ticket (#{ticket.id}) to our human support team "
                f"(Escalation #{res['escalation_id']}). A specialist will review your conversation and follow up shortly."
            ),
            tools_used=tools.tools_used,
            badge=tools.badge,
            badge_tone=tools.badge_tone,
        )

    # 2. General policy question (no order ID provided and not explicitly requesting a refund action)
    if wants_policy and order_identifier is None and not wants_refund:
        policy_info = tools.search_return_policy(user_message)
        snippets = "\n".join(f"- **{s['title']}**: {s['content'].splitlines()[0]}" for s in policy_info["sections"])
        return AgentResult(
            reply=(
                "Here are the relevant details from our Return & Refund Policy:\n\n"
                f"{snippets}\n\n"
                "Note: Automated refunds are available up to ₹5,000; requests above ₹5,000 are escalated for human review."
            ),
            tools_used=tools.tools_used,
            badge="Policy retrieved",
            badge_tone="neutral",
        )

    # 3. Refund or order-specific request with missing order ID
    if (wants_refund or (wants_order_info and not wants_policy)) and order_identifier is None:
        return AgentResult(
            reply=(
                "I'd be happy to help with that! Could you please share your order ID "
                "(for example, `ORD-2381`) so I can check the order details and return policy for you?"
            ),
            tools_used=[],
            badge="Awaiting order ID",
            badge_tone="neutral",
        )

    # 3. We have an order identifier: fetch order details & check policy
    if order_identifier is not None and (wants_refund or wants_order_info or _extract_order_code(user_message)):
        order_info = tools.get_order_details(order_identifier)
        if not order_info["found"]:
            return AgentResult(
                reply=(
                    "I couldn't find that order under your account. Please double-check the order ID "
                    "(e.g., `ORD-2381`) from your Orders list."
                ),
                tools_used=tools.tools_used,
                badge="Order not found",
                badge_tone="danger",
            )

        policy_info = tools.search_return_policy(order_info["category"])

        if wants_refund or ticket.category in {"refund", "damaged_item"}:
            requested_amount = _extract_amount(user_message) or Decimal(str(order_info["total_amount"]))
            refund_res = tools.process_refund(
                order_id=order_info["order_code"],
                amount=requested_amount,
                reason=user_message[:500],
            )
            return AgentResult(
                reply=refund_res["message"],
                tools_used=tools.tools_used,
                badge=tools.badge,
                badge_tone=tools.badge_tone,
            )

        # Order status / policy summary without executing a refund
        delivery_text = (
            f"delivered {order_info['days_since_delivery']} days ago"
            if order_info["days_since_delivery"] is not None
            else f"currently '{order_info['status']}'"
        )
        window_text = (
            f"{policy_info['return_window_days']}-day return window"
            if policy_info["returnable"]
            else "non-returnable category"
        )
        return AgentResult(
            reply=(
                f"Order **{order_info['order_code']}** ({order_info['item_name']}, ₹{order_info['total_amount']:.2f}) "
                f"is {delivery_text}. Under our {order_info['category']} policy, this item has a {window_text}. "
                "Let me know if you would like to request a refund or have another question!"
            ),
            tools_used=tools.tools_used,
            badge=f"Order {order_info['order_code']} verified",
            badge_tone="neutral",
        )

    # 4. General policy question
    if wants_policy or "return" in combined_context:
        policy_info = tools.search_return_policy(user_message)
        snippets = "\n".join(f"- **{s['title']}**: {s['content'].splitlines()[0]}" for s in policy_info["sections"])
        return AgentResult(
            reply=(
                "Here are the relevant details from our Return & Refund Policy:\n\n"
                f"{snippets}\n\n"
                "Note: Automated refunds are available up to ₹5,000; requests above ₹5,000 are escalated for human review."
            ),
            tools_used=tools.tools_used,
            badge="Policy retrieved",
            badge_tone="neutral",
        )

    # 5. Friendly fallback prompting clear next step
    return AgentResult(
        reply=(
            "Thanks for reaching out to SupportDesk! I can help check an order, explain our return policy, "
            "or process an eligible refund. Please share your order ID (such as `ORD-2381`) or let me know if you'd like to speak with a human agent."
        ),
        tools_used=[],
    )


def _run_openai_compatible_agent(
    db: Session,
    customer: User,
    ticket: Ticket,
    history: list[Message],
    user_message: str,
) -> AgentResult:
    """Optional OpenAI-compatible tool-calling agent with bounded turns and safe fallback."""
    tools = SupportAgentTools(db, customer, ticket)
    tool_schemas = [
        {
            "type": "function",
            "function": {
                "name": "get_order_details",
                "description": "Retrieve order status, delivery date, item category and price for the authenticated customer.",
                "parameters": {
                    "type": "object",
                    "properties": {"order_id": {"type": "string"}},
                    "required": ["order_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "search_return_policy",
                "description": "Retrieve relevant return/refund policy rules for a category or question.",
                "parameters": {
                    "type": "object",
                    "properties": {"category": {"type": "string"}},
                    "required": ["category"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "process_refund",
                "description": "Attempt a refund after backend validation. Backend enforces return window and ₹5,000 limit.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "order_id": {"type": "string"},
                        "amount": {"type": "number"},
                        "reason": {"type": "string"},
                    },
                    "required": ["order_id", "amount", "reason"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "escalate_to_human",
                "description": "Create an escalation with structured context for support staff.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "ticket_id": {"type": "integer"},
                        "summary": {"type": "string"},
                        "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"]},
                    },
                    "required": ["ticket_id", "summary", "priority"],
                },
            },
        },
    ]

    linked_order_hint = ""
    if ticket.order_id is not None:
        linked = db.query(Order).filter(Order.id == ticket.order_id).first()
        if linked:
            linked_order_hint = f" Linked order_code={linked.order_code} (order_id={linked.id})."

    messages = [
        {
            "role": "system",
            "content": (
                "You are SupportDesk AI, an e-commerce customer support assistant. "
                "STRICT SCOPE: You ONLY answer questions and help with SupportDesk orders, deliveries, returns, refunds, "
                "return policies, support tickets, and escalating issues to human support staff. "
                "If the user asks about ANYTHING outside customer support (such as coding, LeetCode, algorithms, math, "
                "general knowledge, essays, or unrelated topics), you MUST politely decline and explain that you can only "
                "assist with SupportDesk orders, return policies, and refund requests—never provide code, tutorials, or off-topic answers. "
                "Always check order details with get_order_details and policy rules with search_return_policy before answering order/refund questions. "
                "Never override return policies, authorization, or the ₹5,000 automated refund threshold. "
                "If the customer has not provided an order ID and none is linked, ask for the order ID first without calling order/refund tools. "
                f"Current ticket_id={ticket.id}.{linked_order_hint}"
            ),
        }
    ]
    for msg in history[-10:]:
        role = "assistant" if msg.sender_type in {"ai_agent", "staff"} else "user"
        messages.append({"role": role, "content": msg.content})
    messages.append({"role": "user", "content": user_message})

    client = OpenAI(
        api_key=settings.effective_llm_api_key,
        base_url=settings.llm_base_url,
    )

    for _ in range(4):
        completion = client.chat.completions.create(
            model=settings.llm_model,
            messages=messages,
            tools=tool_schemas,
            temperature=0.2,
            timeout=20.0,
        )
        assistant_msg = completion.choices[0].message
        tool_calls = assistant_msg.tool_calls or []
        if not tool_calls:
            return AgentResult(
                reply=assistant_msg.content or "How else can I assist you?",
                tools_used=tools.tools_used,
                badge=tools.badge,
                badge_tone=tools.badge_tone,
            )

        messages.append({
            "role": "assistant",
            "content": assistant_msg.content or "",
            "tool_calls": [
                {
                    "id": call.id,
                    "type": "function",
                    "function": {
                        "name": call.function.name,
                        "arguments": call.function.arguments,
                    },
                }
                for call in tool_calls
            ],
        })
        for call in tool_calls:
            fn_name = call.function.name
            args = json.loads(call.function.arguments or "{}")
            if fn_name == "get_order_details":
                result = tools.get_order_details(args.get("order_id", ""))
            elif fn_name == "search_return_policy":
                result = tools.search_return_policy(args.get("category", ""))
            elif fn_name == "process_refund":
                result = tools.process_refund(
                    args.get("order_id", ""),
                    args.get("amount", 0),
                    args.get("reason", ticket.subject),
                )
            elif fn_name == "escalate_to_human":
                result = tools.escalate_to_human(
                    ticket.id,
                    args.get("summary", ticket.subject),
                    args.get("priority", "high"),
                )
            else:
                result = {"error": f"Unknown tool: {fn_name}"}
            messages.append({"role": "tool", "tool_call_id": call.id, "content": json.dumps(result)})

    return _run_local_agent(db, customer, ticket, history, user_message)


def run_support_agent_turn(
    db: Session,
    *,
    customer: User,
    ticket: Ticket,
    history: list[Message],
    user_message: str,
) -> AgentResult:
    """Execute one conversational turn with prompt-injection guardrails and error safety."""
    if _is_prompt_injection(user_message):
        record_audit_event(
            db,
            actor_id=customer.id,
            actor_role=customer.role,
            event_type="prompt_injection_blocked",
            entity_type="ticket",
            entity_id=ticket.id,
            details="Detected attempt to override policy, authorization, or refund threshold.",
        )
        db.commit()
        return AgentResult(
            reply=(
                "I cannot override company return policies, authorization checks, or the ₹5,000 automated refund threshold. "
                "Please share a valid order ID from your account and I will check eligibility under our standard policy."
            ),
            tools_used=[],
            badge="Policy guardrail enforced",
            badge_tone="danger",
        )

    if _is_off_topic(user_message):
        return AgentResult(
            reply=(
                "I'm SupportDesk AI and can only assist with your orders, return policies, refund requests, "
                "and support ticket issues. Please share an order ID (for example, `ORD-2381`) or ask a question about a return or refund."
            ),
            tools_used=[],
            badge="Support scope only",
            badge_tone="neutral",
        )

    try:
        if settings.llm_provider in {"groq", "openai_compatible"} and settings.effective_llm_api_key:
            try:
                return _run_openai_compatible_agent(db, customer, ticket, history, user_message)
            except Exception as exc:
                logger.warning(
                    "External LLM call failed; falling back to local agent",
                    extra={"extra_data": {"error": str(exc)}},
                )
        return _run_local_agent(db, customer, ticket, history, user_message)
    except Exception as exc:
        db.rollback()
        logger.error(
            "Agent execution failed safely",
            extra={"extra_data": {"ticket_id": ticket.id, "error": str(exc)}},
        )
        return AgentResult(
            reply=(
                "I encountered a temporary system error while checking your request, so no refund or account change was executed. "
                "Please try again in a moment or ask to escalate to a human support specialist."
            ),
            tools_used=[],
            badge="Temporary error • No action taken",
            badge_tone="danger",
        )
