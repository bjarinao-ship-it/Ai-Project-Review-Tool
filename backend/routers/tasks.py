import os
import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Task, Module, User, TaskReferenceDoc
from backend.schemas import TaskCreate, TaskUpdate, TaskAssign, TaskOut, ReferenceDocOut
from backend.auth import get_current_user, require_admin, hash_password
from backend.services.document_parser import extract_text_from_file
from backend.services.email_service import send_task_assignment_email
from backend.config import settings

router = APIRouter(prefix="/tasks", tags=["Tasks"])

UPLOAD_REF_DIR = os.path.join(settings.UPLOAD_DIR, "reference_docs")
os.makedirs(UPLOAD_REF_DIR, exist_ok=True)

@router.post("", response_model=TaskOut)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    module = db.query(Module).filter(Module.id == payload.module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    candidate = None
    if payload.candidate_email:
        email = payload.candidate_email.lower().strip()
        candidate = db.query(User).filter(User.email == email).first()
        if not candidate:
            name = payload.candidate_name.strip() if payload.candidate_name else email.split("@")[0]
            candidate = User(
                name=name,
                email=email,
                password_hash=hash_password("candidate123"), # default temp password
                role="candidate"
            )
            db.add(candidate)
            db.commit()
            db.refresh(candidate)

    task = Task(
        module_id=module.id,
        title=payload.title.strip(),
        description=payload.description.strip(),
        tech_stack=payload.tech_stack or "",
        deliverables=payload.deliverables or "",
        submission_deadline=payload.submission_deadline,
        review_datetime=payload.review_datetime,
        passing_score=payload.passing_score if payload.passing_score is not None else 70,
        status="Assigned" if candidate else "Assigned",
        assigned_candidate_id=candidate.id if candidate else None
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    # If candidate is assigned, dispatch assignment email
    if candidate:
        send_task_assignment_email(task, candidate, db)

    return task

@router.get("", response_model=List[TaskOut])
def list_tasks(
    module_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Task)
    if current_user.role == "candidate":
        # Candidates can only see their own assigned tasks
        query = query.filter(Task.assigned_candidate_id == current_user.id)
    
    if module_id:
        query = query.filter(Task.module_id == module_id)

    tasks = query.order_by(Task.created_at.desc()).all()
    return tasks

@router.get("/{task_id}", response_model=TaskOut)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Candidate security check
    if current_user.role == "candidate" and task.assigned_candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied: Not your assigned task")

    return task

@router.post("/{task_id}/assign", response_model=TaskOut)
def assign_task_to_candidate(
    task_id: int,
    payload: TaskAssign,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    email = payload.candidate_email.lower().strip()
    candidate = db.query(User).filter(User.email == email).first()
    if not candidate:
        name = payload.candidate_name.strip() if payload.candidate_name else email.split("@")[0]
        candidate = User(
            name=name,
            email=email,
            password_hash=hash_password("candidate123"),
            role="candidate"
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)

    task.assigned_candidate_id = candidate.id
    task.status = "Assigned"
    db.commit()
    db.refresh(task)

    # Dispatch assignment email and record attempt
    send_task_assignment_email(task, candidate, db)

    return task

@router.put("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # If candidate, allow them to move status to 'In Progress'
    if current_user.role == "candidate":
        if task.assigned_candidate_id != current_user.id:
            raise HTTPException(status_code=403, detail="Forbidden")
        if payload.status in ("In Progress",):
            task.status = payload.status
            db.commit()
            db.refresh(task)
            return task
        raise HTTPException(status_code=403, detail="Candidates cannot modify task settings")

    # Admin update
    if payload.title is not None:
        task.title = payload.title.strip()
    if payload.description is not None:
        task.description = payload.description.strip()
    if payload.tech_stack is not None:
        task.tech_stack = payload.tech_stack.strip()
    if payload.deliverables is not None:
        task.deliverables = payload.deliverables.strip()
    if payload.submission_deadline is not None:
        task.submission_deadline = payload.submission_deadline
    if payload.review_datetime is not None:
        task.review_datetime = payload.review_datetime
    if payload.passing_score is not None:
        task.passing_score = payload.passing_score
    if payload.status is not None:
        task.status = payload.status

    db.commit()
    db.refresh(task)
    return task

@router.post("/{task_id}/reference-docs", response_model=ReferenceDocOut)
async def upload_reference_document(
    task_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".pdf", ".docx", ".doc", ".txt", ".md"):
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, or TXT reference files are supported")

    unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = os.path.join(UPLOAD_REF_DIR, unique_filename)

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Extract text from reference doc
    try:
        extracted_text = extract_text_from_file(file_path)
    except Exception as e:
        extracted_text = f"Error extracting document text: {str(e)}"

    ref_doc = TaskReferenceDoc(
        task_id=task.id,
        filename=file.filename,
        file_path=file_path,
        file_type=ext.replace(".", ""),
        extracted_text=extracted_text
    )
    db.add(ref_doc)
    db.commit()
    db.refresh(ref_doc)
    return ref_doc

