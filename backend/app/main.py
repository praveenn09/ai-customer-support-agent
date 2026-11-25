from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.database import SessionLocal
from app.logging_config import get_logger, setup_logging
from app.routers import auth, escalations, orders, refunds, tickets
from app.services.policy_service import search_return_policy

setup_logging(settings.log_level)
logger = get_logger("supportdesk.main")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("SupportDesk API starting", extra={"extra_data": {"environment": settings.environment}})
    yield
    logger.info("SupportDesk API shutting down")


app = FastAPI(
    title="SupportDesk API",
    description="AI-assisted e-commerce customer support, order lookup, refund validation, and human escalation API.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "error_code": f"HTTP_{exc.status_code}"},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Validation error on request payload.",
            "error_code": "VALIDATION_ERROR",
            "errors": exc.errors(),
        },
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(_request: Request, exc: SQLAlchemyError):
    logger.error("Database failure", extra={"extra_data": {"error": str(exc)}})
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "detail": "Database is temporarily unavailable. No changes were saved.",
            "error_code": "DATABASE_UNAVAILABLE",
        },
    )


@app.get("/api/health", tags=["System"])
def health_check():
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except SQLAlchemyError as exc:
        logger.error("Health check database failure", extra={"extra_data": {"error": str(exc)}})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database health check failed.",
        )
    finally:
        db.close()


@app.get("/api/policy/search", tags=["System"])
def policy_search(q: str = "electronics"):
    return search_return_policy(q)


app.include_router(auth.router)
app.include_router(orders.router)
app.include_router(tickets.router)
app.include_router(refunds.router)
app.include_router(escalations.router)
