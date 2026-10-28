import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from sqlalchemy.orm import Session
from backend.config import settings
from backend.models import Task, User, ReviewReport, EmailLog

def is_smtp_configured() -> bool:
    """Checks if valid SMTP credentials are provided."""
    return bool(settings.SMTP_USER and settings.SMTP_PASS)


def send_email_sync(
    to_email: str,
    subject: str,
    html_body: str,
    email_type: str,
    db: Session,
    task_id: int = None
) -> dict:
    """
    Core reusable email sender using Python's standard smtplib.
    Supports STARTTLS (port 587) and SSL (port 465).
    Persists attempt details in SQLite EmailLog table.
    """
    log_entry = EmailLog(
        task_id=task_id,
        recipient_email=to_email,
        email_type=email_type,
        subject=subject,
        body=html_body,
        sent_at=datetime.utcnow(),
    )

    if not is_smtp_configured():
        msg = "SMTP_USER or SMTP_PASS not set in backend/.env. Email dispatch simulated/skipped. Configure credentials in Audit Logs or backend/.env."
        log_entry.status = "FAILED"
        log_entry.error_message = msg
        db.add(log_entry)
        db.commit()
        return {"success": False, "status": "FAILED", "error": msg}

    smtp_user = settings.SMTP_USER
    smtp_pass = settings.SMTP_PASS
    from_email = settings.EMAIL_FROM or smtp_user

    # Construct MIME message
    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = from_email
    message["To"] = to_email

    # Plain text version and HTML version
    part = MIMEText(html_body, "html", "utf-8")
    message.attach(part)

    try:
        if settings.SMTP_PORT == 465 or settings.SMTP_SECURE:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
            server.ehlo()
            server.starttls()
            server.ehlo()

        server.login(smtp_user, smtp_pass)
        server.sendmail(from_email, [to_email], message.as_string())
        server.quit()

        log_entry.status = "SENT"
        log_entry.error_message = None
        db.add(log_entry)
        db.commit()
        return {"success": True, "status": "SENT", "error": None}

    except Exception as exc:
        err_msg = f"SMTP Error: {str(exc)}"
        log_entry.status = "FAILED"
        log_entry.error_message = err_msg
        db.add(log_entry)
        db.commit()
        return {"success": False, "status": "FAILED", "error": err_msg}


def send_task_assignment_email(task: Task, candidate: User, db: Session) -> dict:
    """
    Sends assignment email containing candidate name, project and task name,
    description, submission deadline, review date and time, and application link.
    """
    subject = f"New Task Assigned: {task.title}"
    task_url = f"{settings.FRONTEND_URL}/tasks/{task.id}"
    deadline_str = task.submission_deadline.strftime("%Y-%m-%d %H:%M") if task.submission_deadline else "TBD"
    review_str = task.review_datetime.strftime("%Y-%m-%d %H:%M") if task.review_datetime else "TBD"

    project_name = task.module.project.name if task.module and task.module.project else "Project"

    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1e3a8a;">Task Assignment Notification</h2>
        <p>Hello <strong>{candidate.name}</strong>,</p>
        <p>You have been assigned a new task in <strong>{project_name}</strong>.</p>
        
        <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Task Title:</strong> {task.title}</p>
            <p style="margin: 4px 0;"><strong>Tech Stack:</strong> {task.tech_stack or 'Not specified'}</p>
            <p style="margin: 4px 0;"><strong>Submission Deadline:</strong> {deadline_str}</p>
            <p style="margin: 4px 0;"><strong>Scheduled Review:</strong> {review_str}</p>
        </div>

        <p><strong>Description:</strong></p>
        <p style="color: #475569;">{task.description}</p>

        <p><strong>Deliverables:</strong></p>
        <p style="color: #475569;">{task.deliverables or 'Check task details on the platform.'}</p>

        <div style="margin-top: 24px;">
            <a href="{task_url}" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                View Task & Chat with AI Mentor
            </a>
        </div>

        <hr style="margin-top: 30px; border: 0; border-top: 1px solid #e2e8f0;">
        <p style="font-size: 12px; color: #94a3b8;">AI Project Review Tool &bull; Automated notification</p>
    </div>
    """

    return send_email_sync(
        to_email=candidate.email,
        subject=subject,
        html_body=html,
        email_type="assignment",
        db=db,
        task_id=task.id
    )


def send_review_report_email(task: Task, candidate: User, report: ReviewReport, db: Session) -> dict:
    """
    Sends automated email after review report is generated:
    Review completion status, short feedback summary, overall score,
    link to report, and next review date/time.
    """
    subject = f"Review Completed for Task: {task.title} (Score: {report.overall_score}/100)"
    task_url = f"{settings.FRONTEND_URL}/tasks/{task.id}"
    review_str = task.review_datetime.strftime("%Y-%m-%d %H:%M") if task.review_datetime else "Scheduled"

    status_badge_color = "#16a34a" if report.overall_score >= task.passing_score else "#ea580c"
    status_text = "PASSED" if report.overall_score >= task.passing_score else "NEEDS REVISION"

    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1e3a8a;">AI Documentation Review Result</h2>
        <p>Hello <strong>{candidate.name}</strong>,</p>
        <p>Your documentation for task <strong>{task.title}</strong> has been evaluated by the AI Reviewer.</p>
        
        <div style="background-color: #f8fafc; border-left: 4px solid {status_badge_color}; padding: 12px 16px; margin: 16px 0;">
            <p style="margin: 4px 0; font-size: 18px;">
                <strong>Overall Score:</strong> <span style="color: {status_badge_color}; font-weight: bold;">{report.overall_score}/100</span>
                (Passing: {task.passing_score}/100)
            </p>
            <p style="margin: 4px 0;"><strong>Status:</strong> <span style="font-weight: bold; color: {status_badge_color};">{status_text}</span></p>
            <p style="margin: 4px 0;"><strong>Next Review Meeting:</strong> {review_str}</p>
        </div>

        <p>Please log in to your dashboard to inspect the detailed requirement breakdown, strengths, gaps, and improvement suggestions.</p>

        <div style="margin-top: 24px;">
            <a href="{task_url}" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                View Full Review Report
            </a>
        </div>

        <hr style="margin-top: 30px; border: 0; border-top: 1px solid #e2e8f0;">
        <p style="font-size: 12px; color: #94a3b8;">AI Project Review Tool &bull; Automated notification</p>
    </div>
    """

    return send_email_sync(
        to_email=candidate.email,
        subject=subject,
        html_body=html,
        email_type="review_report",
        db=db,
        task_id=task.id
    )


def send_reminder_email(task: Task, candidate: User, reminder_type: str, db: Session) -> dict:
    """
    Sends deadline or review reminder emails.
    """
    task_url = f"{settings.FRONTEND_URL}/tasks/{task.id}"

    if reminder_type == "deadline_reminder":
        subject = f"Reminder: Submission Deadline Approaching for {task.title}"
        deadline_str = task.submission_deadline.strftime("%Y-%m-%d %H:%M") if task.submission_deadline else "Soon"
        message_body = f"This is a friendly reminder that the submission deadline for your task <strong>{task.title}</strong> is <strong>{deadline_str}</strong>. Please ensure your documentation is uploaded before the deadline."
    else:
        subject = f"Reminder: Review Meeting Scheduled for {task.title}"
        review_str = task.review_datetime.strftime("%Y-%m-%d %H:%M") if task.review_datetime else "Soon"
        message_body = f"This is a reminder that your project review session for task <strong>{task.title}</strong> is scheduled for <strong>{review_str}</strong>."

    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #d97706;">Appointment & Deadline Reminder</h2>
        <p>Hello <strong>{candidate.name}</strong>,</p>
        <p>{message_body}</p>

        <div style="margin-top: 20px;">
            <a href="{task_url}" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Open Task Dashboard
            </a>
        </div>

        <hr style="margin-top: 30px; border: 0; border-top: 1px solid #e2e8f0;">
        <p style="font-size: 12px; color: #94a3b8;">AI Project Review Tool &bull; Automated Reminder</p>
    </div>
    """

    return send_email_sync(
        to_email=candidate.email,
        subject=subject,
        html_body=html,
        email_type=reminder_type,
        db=db,
        task_id=task.id
    )

