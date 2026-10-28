import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.config import settings
from backend.database import engine, Base, SessionLocal
from backend.models import User, Project, Module, Task
from backend.auth import hash_password
from backend.routers import auth, projects, tasks, mentor, reviews, reminders
from backend.services.reminder_scheduler import start_scheduler, stop_scheduler

def seed_initial_data():
    """Seeds default admin, candidate, and sample project/task if database is empty."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.email == "admin@reviewtool.local").first()
        if not admin_user:
            admin_user = User(
                name="Project Manager (Admin)",
                email="admin@reviewtool.local",
                password_hash=hash_password("admin123"),
                role="admin"
            )
            db.add(admin_user)

        candidate_user = db.query(User).filter(User.email == "candidate@example.com").first()
        if not candidate_user:
            candidate_user = User(
                name="Alex Developer",
                email="candidate@example.com",
                password_hash=hash_password("candidate123"),
                role="candidate"
            )
            db.add(candidate_user)

        db.commit()
        db.refresh(admin_user)
        db.refresh(candidate_user)

        # Check if any project exists
        project = db.query(Project).first()
        if not project:
            sample_project = Project(
                name="AI Cloud Microservices Platform",
                description="Modern cloud services with AI-driven workflows and real-time processing.",
                created_by_id=admin_user.id
            )
            db.add(sample_project)
            db.commit()
            db.refresh(sample_project)

            sample_module = Module(
                project_id=sample_project.id,
                name="Authentication & Token Service",
                description="Robust JWT auth and role-based access control engine."
            )
            db.add(sample_module)
            db.commit()
            db.refresh(sample_module)

            now = datetime.utcnow()
            sample_task = Task(
                module_id=sample_module.id,
                title="Implement Secure JWT Auth & Role Middleware",
                description="Develop a secure JWT authentication system with role-based access control, token refresh, and SQLite database persistence.",
                tech_stack="Python, FastAPI, SQLite, PyJWT, Pydantic",
                deliverables="1. Password hashing with SHA256/bcrypt\n2. Token generation and verification\n3. Role validation middleware\n4. Unit test suite\n5. Architectural and API documentation",
                submission_deadline=now + timedelta(days=3),
                review_datetime=now + timedelta(days=4),
                passing_score=75,
                status="Assigned",
                assigned_candidate_id=candidate_user.id
            )
            db.add(sample_task)
            db.commit()

    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables & initial data exist
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    seed_initial_data()
    # Start reminder background scheduler
    start_scheduler(interval_seconds=60)
    yield
    # Shutdown
    stop_scheduler()


app = FastAPI(
    title="AI Project Review Tool API",
    description="Backend API for AI Project Review Tool with mentor chatbot, document analysis, and SMTP alerts.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(mentor.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(reminders.router, prefix="/api")

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app_env": settings.APP_ENV,
        "llm_provider": settings.LLM_PROVIDER,
        "llm_model": settings.LLM_MODEL,
        "smtp_configured": bool(settings.SMTP_USER and settings.SMTP_PASS)
    }

# Frontend Static Mounting (Single Host Serving)
dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

if os.path.exists(os.path.join(dist_dir, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_dir, "assets")), name="assets")

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    file_path = os.path.join(dist_dir, full_path)
    if full_path and os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    index_path = os.path.join(dist_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "AI Project Review Tool API running."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)

