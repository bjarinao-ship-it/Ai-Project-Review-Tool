import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base
from backend.models import EmailLog, Task, User
from backend.services.email_service import is_smtp_configured, send_email_sync
from backend.config import settings

TEST_ENGINE = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=TEST_ENGINE)

@pytest.fixture
def db():
    Base.metadata.create_all(bind=TEST_ENGINE)
    session = TestSession()
    yield session
    session.close()
    Base.metadata.drop_all(bind=TEST_ENGINE)

def test_smtp_configuration_detection():
    # If SMTP_USER is blank, is_smtp_configured returns False
    original_user = settings.SMTP_USER
    original_pass = settings.SMTP_PASS

    settings.SMTP_USER = ""
    settings.SMTP_PASS = ""
    assert is_smtp_configured() is False

    settings.SMTP_USER = "test@gmail.com"
    settings.SMTP_PASS = "app-password"
    assert is_smtp_configured() is True

    # Restore
    settings.SMTP_USER = original_user
    settings.SMTP_PASS = original_pass

def test_email_attempt_logging_without_crashing(db):
    original_user = settings.SMTP_USER
    original_pass = settings.SMTP_PASS
    settings.SMTP_USER = ""
    settings.SMTP_PASS = ""

    result = send_email_sync(
        to_email="test_candidate@example.com",
        subject="Task Assignment",
        html_body="<p>Task details</p>",
        email_type="assignment",
        db=db,
        task_id=1
    )

    assert result["success"] is False
    assert result["status"] == "FAILED"
    assert "not set" in result["error"].lower()

    # Verify log entry in SQLite
    log = db.query(EmailLog).filter(EmailLog.recipient_email == "test_candidate@example.com").first()
    assert log is not None
    assert log.status == "FAILED"
    assert log.email_type == "assignment"
    assert log.subject == "Task Assignment"

    # Restore
    settings.SMTP_USER = original_user
    settings.SMTP_PASS = original_pass

