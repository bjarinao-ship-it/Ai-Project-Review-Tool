import os
import re
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import EmailLog, ReminderRecord, User
from backend.schemas import EmailLogOut
from backend.auth import get_current_user, require_admin
from backend.config import settings
from backend.services.reminder_scheduler import check_and_dispatch_pending_reminders
from backend.services.email_service import is_smtp_configured, send_email_sync

router = APIRouter(prefix="/reminders", tags=["Reminders & Email Logs"])

class SMTPSettingsUpdate(BaseModel):
    smtp_user: str
    smtp_pass: str
    smtp_host: Optional[str] = "smtp.gmail.com"
    smtp_port: Optional[int] = 587
    email_from: Optional[str] = ""

class TestEmailRequest(BaseModel):
    recipient_email: str

@router.get("/smtp-status")
def get_smtp_status(admin: User = Depends(require_admin)):
    configured = is_smtp_configured()
    user_str = settings.SMTP_USER
    masked_user = f"{user_str[:3]}***@{user_str.split('@')[1]}" if "@" in user_str else (user_str if user_str else "")
    return {
        "is_configured": configured,
        "smtp_host": settings.SMTP_HOST,
        "smtp_port": settings.SMTP_PORT,
        "smtp_user": masked_user,
        "full_smtp_user": settings.SMTP_USER,
        "email_from": settings.EMAIL_FROM or settings.SMTP_USER
    }

@router.post("/save-smtp")
def save_smtp_settings(payload: SMTPSettingsUpdate, admin: User = Depends(require_admin)):
    """Saves SMTP credentials to backend/.env and reloads configuration."""
    env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    
    lines = []
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            lines = f.readlines()

    clean_pass = payload.smtp_pass.replace(" ", "").strip()
    clean_user = payload.smtp_user.strip()

    updates = {
        "SMTP_USER": clean_user,
        "SMTP_PASS": clean_pass,
        "SMTP_HOST": payload.smtp_host or "smtp.gmail.com",
        "SMTP_PORT": str(payload.smtp_port or 587),
        "EMAIL_FROM": payload.email_from.strip() or clean_user,
    }

    new_lines = []
    found_keys = set()
    for line in lines:
        matched = False
        for k, v in updates.items():
            if line.startswith(f"{k}="):
                new_lines.append(f"{k}={v}\n")
                found_keys.add(k)
                matched = True
                break
        if not matched:
            new_lines.append(line)

    for k, v in updates.items():
        if k not in found_keys:
            new_lines.append(f"{k}={v}\n")

    with open(env_file, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

    # Update environment directly
    for k, v in updates.items():
        os.environ[k] = v

    return {
        "status": "success",
        "message": "SMTP credentials saved and updated successfully.",
        "is_configured": is_smtp_configured()
    }

@router.post("/test-email")
def send_test_email(
    payload: TestEmailRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Sends a real test email through Gmail SMTP and returns exact status or server error."""
    to_email = payload.recipient_email.strip()
    if not to_email:
        raise HTTPException(status_code=400, detail="Recipient email is required")

    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h3 style="color: #2563eb;">AI Project Review Tool - SMTP Test</h3>
        <p>This is a verification email confirming that your Gmail SMTP configuration is working correctly.</p>
        <p><strong>SMTP Host:</strong> {settings.SMTP_HOST}:{settings.SMTP_PORT}</p>
        <p><strong>From:</strong> {settings.EMAIL_FROM or settings.SMTP_USER}</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 20px;">
        <p style="font-size: 11px; color: #94a3b8;">Automated notification from AI Project Review Tool</p>
    </div>
    """

    res = send_email_sync(
        to_email=to_email,
        subject="AI Project Review Tool - SMTP Test Verification",
        html_body=html,
        email_type="test_verification",
        db=db
    )

    return res

@router.post("/check")
def trigger_reminder_check(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Admin endpoint to immediately trigger reminder scan and dispatch."""
    count = check_and_dispatch_pending_reminders()
    return {"status": "success", "processed_reminders": count}

@router.get("/logs", response_model=List[EmailLogOut])
def get_email_logs(
    task_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """View email delivery attempt history."""
    query = db.query(EmailLog)
    if task_id:
        query = query.filter(EmailLog.task_id == task_id)
    return query.order_by(EmailLog.sent_at.desc()).limit(100).all()

@router.get("/records")
def get_reminder_records(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """View automated reminder task scheduling records."""
    records = db.query(ReminderRecord).order_by(ReminderRecord.created_at.desc()).limit(100).all()
    return [
        {
            "id": r.id,
            "task_id": r.task_id,
            "task_title": r.task.title if r.task else "Unknown",
            "reminder_type": r.reminder_type,
            "scheduled_for": r.scheduled_for,
            "sent_at": r.sent_at,
            "status": r.status,
            "created_at": r.created_at,
        }
        for r in records
    ]
