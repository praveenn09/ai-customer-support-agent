from sqlalchemy.orm import Session

from app.logging_config import get_logger
from app.models import AuditLog

logger = get_logger("supportdesk.audit")


def record_audit_event(
    db: Session,
    *,
    actor_id: int | None,
    actor_role: str,
    event_type: str,
    entity_type: str,
    entity_id: str | int,
    details: str | None = None,
) -> AuditLog:
    """Persist an audit log entry and emit a structured log line."""
    entry = AuditLog(
        actor_id=actor_id,
        actor_role=actor_role,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=str(entity_id),
        details=details,
    )
    db.add(entry)
    logger.info(
        "Audit event recorded",
        extra={
            "extra_data": {
                "actor_id": actor_id,
                "actor_role": actor_role,
                "event_type": event_type,
                "entity_type": entity_type,
                "entity_id": str(entity_id),
            }
        },
    )
    return entry
