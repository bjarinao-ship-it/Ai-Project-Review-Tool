import os
import uuid
import json
from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Task, Submission, ReviewReport, User
from backend.schemas import ReviewReportOut, SubmissionOut
from backend.auth import get_current_user
from backend.services.document_parser import extract_text_from_file
from backend.services.ai_reviewer import generate_ai_review
from backend.services.email_service import send_review_report_email
from backend.config import settings

router = APIRouter(tags=["Submissions & AI Reviews"])

UPLOAD_SUB_DIR = os.path.join(settings.UPLOAD_DIR, "submissions")
os.makedirs(UPLOAD_SUB_DIR, exist_ok=True)

def parse_report_fields(report: ReviewReport) -> dict:
    """Helper to deserialize JSON text fields into native Python dicts/lists for response."""
    return {
        "id": report.id,
        "task_id": report.task_id,
        "submission_id": report.submission_id,
        "overall_score": report.overall_score,
        "requirement_statuses": json.loads(report.requirement_statuses) if report.requirement_statuses else [],
        "missing_requirements": json.loads(report.missing_requirements) if report.missing_requirements else [],
        "strengths": json.loads(report.strengths) if report.strengths else [],
        "weaknesses": json.loads(report.weaknesses) if report.weaknesses else [],
        "improvement_suggestions": json.loads(report.improvement_suggestions) if report.improvement_suggestions else [],
        "recommended_next_steps": json.loads(report.recommended_next_steps) if report.recommended_next_steps else [],
        "raw_llm_response": report.raw_llm_response,
        "created_at": report.created_at,
    }

@router.post("/tasks/{task_id}/submit")
async def submit_documentation(
    task_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if current_user.role == "candidate" and task.assigned_candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".pdf", ".docx", ".doc", ".txt", ".md"):
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, or TXT documentation files are supported")

    # Determine submission version
    prev_submissions = db.query(Submission).filter(Submission.task_id == task.id).all()
    version = len(prev_submissions) + 1

    unique_filename = f"v{version}_{uuid.uuid4().hex[:8]}_{file.filename}"
    file_path = os.path.join(UPLOAD_SUB_DIR, unique_filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Extract text from submitted doc
    try:
        extracted_text = extract_text_from_file(file_path)
    except Exception as e:
        extracted_text = f"Error reading document: {str(e)}"

    submission = Submission(
        task_id=task.id,
        candidate_id=current_user.id,
        version=version,
        filename=file.filename,
        file_path=file_path,
        file_type=ext.replace(".", ""),
        extracted_text=extracted_text
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    # Generate AI Review
    try:
        report = await generate_ai_review(task, submission, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate AI review: {str(e)}")

    # Dispatch review completion email to candidate
    candidate = task.assigned_candidate or current_user
    email_result = send_review_report_email(task, candidate, report, db)

    return {
        "submission": {
            "id": submission.id,
            "version": submission.version,
            "filename": submission.filename,
            "submitted_at": submission.submitted_at
        },
        "review_report": parse_report_fields(report),
        "email_notification": email_result
    }

@router.get("/tasks/{task_id}/submissions", response_model=List[SubmissionOut])
def list_task_submissions(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if current_user.role == "candidate" and task.assigned_candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    submissions = db.query(Submission).filter(Submission.task_id == task_id).order_by(Submission.version.desc()).all()
    return submissions

@router.get("/tasks/{task_id}/reviews")
def list_task_reviews(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if current_user.role == "candidate" and task.assigned_candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    reports = db.query(ReviewReport).filter(ReviewReport.task_id == task_id).order_by(ReviewReport.created_at.desc()).all()
    return [parse_report_fields(r) for r in reports]

@router.get("/reviews/{review_id}")
def get_review_report(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    report = db.query(ReviewReport).filter(ReviewReport.id == review_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Review report not found")

    task = report.task
    if current_user.role == "candidate" and task and task.assigned_candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return parse_report_fields(report)

