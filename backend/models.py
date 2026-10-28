from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from backend.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="candidate", nullable=False) # "admin" or "candidate"
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    assigned_tasks = relationship("Task", back_populates="assigned_candidate", foreign_keys="Task.assigned_candidate_id")
    submissions = relationship("Submission", back_populates="candidate")
    chat_messages = relationship("ChatMessage", back_populates="user")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    modules = relationship("Module", back_populates="project", cascade="all, delete-orphan")


class Module(Base):
    __tablename__ = "modules"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="modules")
    tasks = relationship("Task", back_populates="module", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("modules.id"), nullable=False)
    title = Column(String(250), nullable=False)
    description = Column(Text, nullable=False)
    tech_stack = Column(String(300), default="")
    deliverables = Column(Text, default="")
    submission_deadline = Column(DateTime, nullable=True)
    review_datetime = Column(DateTime, nullable=True)
    passing_score = Column(Integer, default=70)
    status = Column(String(50), default="Assigned") # Assigned, In Progress, Submitted, Needs Revision, Completed
    assigned_candidate_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    module = relationship("Module", back_populates="tasks")
    assigned_candidate = relationship("User", back_populates="assigned_tasks", foreign_keys=[assigned_candidate_id])
    reference_docs = relationship("TaskReferenceDoc", back_populates="task", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="task", cascade="all, delete-orphan")
    review_reports = relationship("ReviewReport", back_populates="task", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="task", cascade="all, delete-orphan")
    email_logs = relationship("EmailLog", back_populates="task")
    reminders = relationship("ReminderRecord", back_populates="task", cascade="all, delete-orphan")


class TaskReferenceDoc(Base):
    __tablename__ = "task_reference_docs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), default="")
    extracted_text = Column(Text, default="")
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", back_populates="reference_docs")


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    candidate_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    version = Column(Integer, default=1)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), default="")
    extracted_text = Column(Text, default="")
    submitted_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", back_populates="submissions")
    candidate = relationship("User", back_populates="submissions")
    review_reports = relationship("ReviewReport", back_populates="submission", cascade="all, delete-orphan")


class ReviewReport(Base):
    __tablename__ = "review_reports"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    overall_score = Column(Integer, nullable=False)
    # Stored as serialized JSON string
    requirement_statuses = Column(Text, default="[]") 
    missing_requirements = Column(Text, default="[]")
    strengths = Column(Text, default="[]")
    weaknesses = Column(Text, default="[]")
    improvement_suggestions = Column(Text, default="[]")
    recommended_next_steps = Column(Text, default="[]")
    raw_llm_response = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", back_populates="review_reports")
    submission = relationship("Submission", back_populates="review_reports")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    sender_type = Column(String(20), nullable=False) # "candidate" or "mentor"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", back_populates="chat_messages")
    user = relationship("User", back_populates="chat_messages")


class EmailLog(Base):
    __tablename__ = "email_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    recipient_email = Column(String(150), nullable=False)
    email_type = Column(String(50), nullable=False) # assignment, review_report, deadline_reminder, review_reminder
    subject = Column(String(255), nullable=False)
    body = Column(Text, default="")
    status = Column(String(20), nullable=False) # "SENT" or "FAILED"
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", back_populates="email_logs")


class ReminderRecord(Base):
    __tablename__ = "reminder_records"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    reminder_type = Column(String(50), nullable=False) # deadline_24h, review_1h, etc.
    scheduled_for = Column(DateTime, nullable=False)
    sent_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="PENDING") # PENDING, SENT, FAILED
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", back_populates="reminders")

