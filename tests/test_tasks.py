import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base
from backend.models import User, Project, Module, Task
from backend.auth import hash_password

# In-memory SQLite for testing
TEST_ENGINE = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=TEST_ENGINE)

@pytest.fixture
def db():
    Base.metadata.create_all(bind=TEST_ENGINE)
    session = TestSession()
    
    admin = User(name="Test Admin", email="admin@test.com", password_hash=hash_password("admin123"), role="admin")
    candidate = User(name="Test Candidate", email="cand@test.com", password_hash=hash_password("cand123"), role="candidate")
    session.add_all([admin, candidate])
    session.commit()

    project = Project(name="Test Project", created_by_id=admin.id)
    session.add(project)
    session.commit()

    module = Module(project_id=project.id, name="Test Module")
    session.add(module)
    session.commit()

    yield session
    session.close()
    Base.metadata.drop_all(bind=TEST_ENGINE)

def test_task_creation_and_assignment(db):
    module = db.query(Module).first()
    candidate = db.query(User).filter(User.role == "candidate").first()

    deadline = datetime.utcnow() + timedelta(days=2)
    review_dt = datetime.utcnow() + timedelta(days=3)

    task = Task(
        module_id=module.id,
        title="Build Auth Module",
        description="Build secure JWT auth with refresh tokens",
        tech_stack="Python, FastAPI, SQLite",
        deliverables="Working endpoints, DB schema, Documentation",
        submission_deadline=deadline,
        review_datetime=review_dt,
        passing_score=75,
        status="Assigned",
        assigned_candidate_id=candidate.id
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    assert task.id is not None
    assert task.status == "Assigned"
    assert task.assigned_candidate.email == "cand@test.com"
    assert task.passing_score == 75

def test_task_status_lifecycle(db):
    module = db.query(Module).first()
    candidate = db.query(User).filter(User.role == "candidate").first()

    task = Task(
        module_id=module.id,
        title="Frontend Dashboard",
        description="Build responsive UI",
        status="Assigned",
        assigned_candidate_id=candidate.id
    )
    db.add(task)
    db.commit()

    # Candidate starts working
    task.status = "In Progress"
    db.commit()
    assert db.query(Task).filter(Task.id == task.id).first().status == "In Progress"

    # Candidate submits doc
    task.status = "Submitted"
    db.commit()
    assert db.query(Task).filter(Task.id == task.id).first().status == "Submitted"

    # Needs revision
    task.status = "Needs Revision"
    db.commit()
    assert db.query(Task).filter(Task.id == task.id).first().status == "Needs Revision"

    # Completed by admin
    task.status = "Completed"
    db.commit()
    assert db.query(Task).filter(Task.id == task.id).first().status == "Completed"

