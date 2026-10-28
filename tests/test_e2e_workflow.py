import asyncio
import os
import sys
import tempfile
import json

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from backend.database import SessionLocal, Base, engine
from backend.models import User, Project, Module, Task, ReviewReport, EmailLog
from backend.auth import hash_password, create_access_token
from backend.services.ai_mentor import get_or_create_initial_guidance, send_followup_question
from backend.services.ai_reviewer import generate_ai_review
from backend.services.document_parser import extract_text_from_file
from backend.services.email_service import send_task_assignment_email, send_review_report_email
from backend.models import Submission

async def run_e2e_flow():
    print("=== STARTING FULL END-TO-END WORKFLOW TEST ===")
    db = SessionLocal()

    try:
        # 1. Verify / Get Admin and Candidate
        admin = db.query(User).filter(User.role == "admin").first()
        candidate = db.query(User).filter(User.role == "candidate").first()
        assert admin is not None, "Admin user missing"
        assert candidate is not None, "Candidate user missing"
        print(f"[1] Users verified: Admin={admin.email}, Candidate={candidate.email}")

        # 2. Get or Create Project & Module
        project = db.query(Project).first()
        module = project.modules[0] if project.modules else None
        assert project and module, "Project or Module missing"
        print(f"[2] Project & Module verified: {project.name} -> {module.name}")

        # 3. Create Task & Assign Candidate
        now = datetime.utcnow()
        task = Task(
            module_id=module.id,
            title="E2E Real-Time Order Processing Service",
            description="Build a high-performance order ingestion and processing service with SQLite persistence and automated validation.",
            tech_stack="Python, FastAPI, SQLite, Pydantic",
            deliverables="1. POST /orders endpoint\n2. Order status tracking\n3. Input validation with Pydantic\n4. Database persistence in SQLite\n5. Full unit test documentation",
            submission_deadline=now + timedelta(days=2),
            review_datetime=now + timedelta(days=3),
            passing_score=75,
            status="Assigned",
            assigned_candidate_id=candidate.id
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        print(f"[3] Task created: ID={task.id}, Title='{task.title}'")

        # 4. Trigger Assignment Email & Check Log
        email_result = send_task_assignment_email(task, candidate, db)
        print(f"[4] Assignment email attempted: Result={email_result['status']}")
        log = db.query(EmailLog).filter(EmailLog.task_id == task.id, EmailLog.email_type == "assignment").first()
        assert log is not None, "EmailLog entry missing for assignment"
        print(f"    EmailLog persisted in SQLite: status={log.status}, error={log.error_message}")

        # 5. AI Mentor: Generate 8-Point Kickoff Primer
        print("[5] Generating AI Mentor kickoff guidance via OpenRouter...")
        primer = await get_or_create_initial_guidance(task, db, candidate.id)
        assert primer and len(primer.content) > 100
        print(f"    AI Mentor kickoff generated successfully! Length: {len(primer.content)} chars")
        print(f"    Preview: {primer.content[:150]}...")

        # 6. AI Mentor: Candidate asks follow-up question
        print("[6] Asking AI Mentor a follow-up question...")
        followup = await send_followup_question(
            task,
            "What SQLite indexes should I add on the orders table for optimal query performance?",
            db,
            candidate.id
        )
        assert followup and len(followup.content) > 50
        print(f"    Mentor answered follow-up! Preview: {followup.content[:150]}...")

        # 7. Candidate Submits Completed Documentation
        doc_content = """# Order Processing Service Documentation
## Architecture & Implementation Overview
We implemented an Order Processing Service using Python and FastAPI with an SQLite backend.

### 1. POST /orders Endpoint
The service exposes a POST `/orders` endpoint that receives JSON order payloads:
- Validated via Pydantic model `OrderCreate` (customer_id, items, total_amount).
- Stores the record in SQLite database table `orders`.
- Returns HTTP 201 Created with order ID and initial status 'PENDING'.

### 2. Order Status Tracking
A GET `/orders/{id}` endpoint allows querying the current status. Status updates follow the state machine:
PENDING -> PROCESSING -> COMPLETED or FAILED.

### 3. Database Persistence
Database tables are managed via SQLAlchemy 2.0 with SQLite database `orders.db`.
Indexes are created on `orders.customer_id` and `orders.created_at`.

### 4. Unit Test Suite
Unit tests are written using `pytest`. Test cases cover:
- Successful order submission
- Payload validation rejection (invalid total, empty items)
- Database persistence verification

### 5. Unverified Claims
Note: Load testing to 10,000 req/sec was tested in staging, but is omitted from this text doc.
"""
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as f:
            f.write(doc_content)
            temp_doc_path = f.name

        extracted = extract_text_from_file(temp_doc_path)
        submission = Submission(
            task_id=task.id,
            candidate_id=candidate.id,
            version=1,
            filename="Order_Service_Docs.txt",
            file_path=temp_doc_path,
            file_type="txt",
            extracted_text=extracted
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)
        print(f"[7] Submission recorded: Version={submission.version}, Filename={submission.filename}")

        # 8. AI Documentation Review & Scoring
        print("[8] Running AI Documentation Review against requirements...")
        report = await generate_ai_review(task, submission, db)
        print(f"    Review Report Generated! Overall Score: {report.overall_score}/100")
        
        req_statuses = json.loads(report.requirement_statuses)
        print(f"    Requirement Breakdown ({len(req_statuses)} items):")
        for req in req_statuses:
            print(f"      - {req.get('requirement')}: [{req.get('status')}]")

        print(f"    Task updated status: {task.status}")

        # 9. Review Completion Email
        rev_email = send_review_report_email(task, candidate, report, db)
        print(f"[9] Review completion email attempted: Result={rev_email['status']}")
        rev_log = db.query(EmailLog).filter(EmailLog.task_id == task.id, EmailLog.email_type == "review_report").first()
        assert rev_log is not None, "EmailLog entry missing for review report"
        print(f"    Review EmailLog persisted: status={rev_log.status}")

        print("\n=== FULL WORKFLOW TEST COMPLETED SUCCESSFULLY! ===")

    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(run_e2e_flow())
