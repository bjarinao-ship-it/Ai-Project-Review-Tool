from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
from datetime import datetime

# --- Auth Schemas ---
class UserLogin(BaseModel):
    email: str
    password: str

class UserRegister(BaseModel):
    name: str
    email: str
    password: str
    role: Optional[str] = "candidate"

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# --- Project & Module Schemas ---
class ModuleCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class ModuleOut(BaseModel):
    id: int
    project_id: int
    name: str
    description: Optional[str] = ""
    created_at: datetime

    class Config:
        from_attributes = True

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class ProjectOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = ""
    created_at: datetime
    modules: List[ModuleOut] = []

    class Config:
        from_attributes = True

# --- Task Schemas ---
class TaskCreate(BaseModel):
    module_id: int
    title: str
    description: str
    tech_stack: Optional[str] = ""
    deliverables: Optional[str] = ""
    submission_deadline: Optional[datetime] = None
    review_datetime: Optional[datetime] = None
    passing_score: Optional[int] = 70
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    tech_stack: Optional[str] = None
    deliverables: Optional[str] = None
    submission_deadline: Optional[datetime] = None
    review_datetime: Optional[datetime] = None
    passing_score: Optional[int] = None
    status: Optional[str] = None

class TaskAssign(BaseModel):
    candidate_name: str
    candidate_email: str

class ReferenceDocOut(BaseModel):
    id: int
    task_id: int
    filename: str
    file_type: str
    uploaded_at: datetime

    class Config:
        from_attributes = True

class TaskOut(BaseModel):
    id: int
    module_id: int
    title: str
    description: str
    tech_stack: Optional[str] = ""
    deliverables: Optional[str] = ""
    submission_deadline: Optional[datetime] = None
    review_datetime: Optional[datetime] = None
    passing_score: int
    status: str
    assigned_candidate_id: Optional[int] = None
    assigned_candidate: Optional[UserOut] = None
    created_at: datetime
    updated_at: datetime
    reference_docs: List[ReferenceDocOut] = []

    class Config:
        from_attributes = True

# --- Chat Schemas ---
class ChatMessageCreate(BaseModel):
    content: str

class ChatMessageOut(BaseModel):
    id: int
    task_id: int
    user_id: Optional[int] = None
    sender_type: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Review & Submission Schemas ---
class SubmissionOut(BaseModel):
    id: int
    task_id: int
    candidate_id: int
    version: int
    filename: str
    file_type: str
    submitted_at: datetime

    class Config:
        from_attributes = True

class ReviewReportOut(BaseModel):
    id: int
    task_id: int
    submission_id: int
    overall_score: int
    requirement_statuses: Any
    missing_requirements: Any
    strengths: Any
    weaknesses: Any
    improvement_suggestions: Any
    recommended_next_steps: Any
    raw_llm_response: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# --- Email & Reminder Logs ---
class EmailLogOut(BaseModel):
    id: int
    task_id: Optional[int] = None
    recipient_email: str
    email_type: str
    subject: str
    status: str
    error_message: Optional[str] = None
    sent_at: datetime

    class Config:
        from_attributes = True

