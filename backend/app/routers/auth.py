from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import create_access_token, get_current_user, hash_password, verify_password
from app.database import get_db
from app.models import User
from app.schemas import TokenResponse, UserLogin, UserOut, UserRegister
from app.services.audit_service import record_audit_event

router = APIRouter(tags=["Authentication & Users"])


@router.post("/api/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        name=payload.name.strip(),
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role="customer",  # Public registration always creates customer accounts
    )
    db.add(user)
    db.flush()

    record_audit_event(
        db,
        actor_id=user.id,
        actor_role=user.role,
        event_type="user_registered",
        entity_type="user",
        entity_id=user.id,
        details="Customer registered new account.",
    )
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/api/auth/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/api/auth/logout")
def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Logged out successfully.", "user_id": current_user.id}


@router.get("/api/users/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
