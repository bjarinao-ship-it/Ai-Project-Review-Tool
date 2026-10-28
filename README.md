# AI Project Review Tool (MVP)

A functional, low-complexity MVP web application designed for Project Managers and Engineering Candidates. It automates project task assignment, provides full A–Z AI mentorship guidance, extracts submitted project documentation (PDF, DOCX, TXT), evaluates work against acceptance criteria using LLMs, and triggers automated email notifications via Gmail SMTP.

---

## 1. Tech Stack

- **Frontend**: React (v19) + Vite + Tailwind CSS (v4) + Lucide Icons
- **Backend**: Python 3.12 + FastAPI + Uvicorn
- **Database**: SQLite with SQLAlchemy ORM (file-based persistence in `./backend/app.db`)
- **AI Engine**: LLM backend service (OpenRouter / OpenAI / Gemini compatible) with token-capped requests for low token usage and high reliability
- **Document Parser**: PyMuPDF (`fitz` / `pymupdf`) for PDFs, `python-docx` for Word documents, and UTF-8 decoder for TXT/Markdown
- **Email Service**: Python `smtplib` with STARTTLS (port 587) for Gmail SMTP, persistent SQLite audit logging, and graceful failure handling
- **Scheduler**: Lightweight background scheduler & on-demand scanner for deadline and review appointment reminders

---

## 2. Directory Structure

```
Ai Project/
├── backend/
│   ├── config.py                 # Pydantic/Environment settings
│   ├── database.py               # SQLite engine & session setup
│   ├── models.py                 # SQLAlchemy models (User, Task, ReviewReport, etc.)
│   ├── schemas.py                # Pydantic request/response schemas
│   ├── auth.py                   # Role-based JWT authentication
│   ├── main.py                   # FastAPI application & lifecycle
│   ├── requirements.txt          # Python dependencies
│   ├── .env                      # Active environment secrets
│   ├── .env.example              # Template configuration
│   ├── routers/
│   │   ├── auth.py               # Login, registration, demo user switcher
│   │   ├── projects.py           # Projects and modules management
│   │   ├── tasks.py              # Task creation, assignment, reference docs
│   │   ├── mentor.py             # AI mentor primer & follow-up chat
│   │   ├── reviews.py            # Document submission & AI evaluation
│   │   └── reminders.py          # Email audit logs & scheduler triggers
│   └── services/
│       ├── document_parser.py    # PyMuPDF, python-docx, TXT extractor
│       ├── llm_service.py        # Configurable LLM API connector
│       ├── ai_mentor.py          # 8-point primer & context builder
│       ├── ai_reviewer.py        # Structured JSON evaluation & scoring
│       ├── email_service.py      # Reusable Gmail SMTP sender
│       └── reminder_scheduler.py # Background reminder runner
├── frontend/
│   ├── src/
│   │   ├── api.js                # Frontend API client
│   │   ├── App.jsx               # Root application view router
│   │   ├── main.jsx              # Entry point with AuthProvider
│   │   ├── context/
│   │   │   └── AuthContext.jsx   # Authentication & session context
│   │   └── components/
│   │       ├── Navbar.jsx        # Navigation & 1-click user switcher
│   │       ├── AuthView.jsx      # Sign in, register & quick demo access
│   │       ├── AdminDashboard.jsx# PM management console & task modal
│   │       ├── CandidateDashboard.jsx # Candidate task list & schedules
│   │       ├── TaskWorkspace.jsx # AI Mentor chat, doc upload & reports
│   │       ├── StatusBadge.jsx   # Color-coded status badges
│   │       └── LogsModal.jsx     # Audit logs & on-demand scheduler
│   ├── package.json
│   └── vite.config.js
├── tests/
│   ├── test_tasks.py             # Task assignment & lifecycle tests
│   ├── test_review_scoring.py    # Structured JSON & score validation tests
│   ├── test_email_config.py      # SMTP status & error logging tests
│   └── test_e2e_workflow.py      # Full end-to-end integration test
├── .gitignore
├── package.json
└── README.md
```

---

## 3. Environment Configuration

The backend reads configuration from `backend/.env`. A template is provided in `backend/.env.example`:

```ini
APP_ENV=development
DATABASE_URL=sqlite:///./app.db
LLM_PROVIDER=openrouter
LLM_API_KEY=your_api_key_here
LLM_MODEL=google/gemini-2.5-flash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_authorized_gmail@gmail.com
SMTP_PASS=your_gmail_app_password
SMTP_SECURE=false
EMAIL_FROM=your_authorized_gmail@gmail.com
FRONTEND_URL=http://localhost:5173
DEFAULT_TIMEZONE=Asia/Kolkata
```

> **Note on Gmail SMTP**: To send actual emails via Gmail, create a Google App Password at [Google Account App Passwords](https://myaccount.google.com/apppasswords) and supply it in `SMTP_PASS`. If left empty, the application records delivery attempts as `FAILED` in SQLite without crashing.

---

## 4. Setup & Running Instructions

### Step 1: Install Backend Dependencies
Open a terminal in the root folder:
```bash
pip install -r backend/requirements.txt
```

### Step 2: Run the Backend API Server
```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
The FastAPI backend will start at `http://localhost:8000`. Database tables and initial seed data are initialized automatically on startup. Interactive Swagger documentation is available at `http://localhost:8000/docs`.

### Step 3: Run the Frontend Development Server
Open a second terminal:
```bash
cd frontend
npm install
npm run dev
```
The Vite development server will start at `http://localhost:5173`.

---

## 5. Pre-Seeded Demo Accounts

For instant testing and evaluation, you can log in with one click from the UI banner or with these credentials:

| Role | Email | Password |
|---|---|---|
| **Project Manager (Admin)** | `admin@reviewtool.local` | `admin123` |
| **Candidate** | `candidate@example.com` | `candidate123` |

You can toggle between Admin and Candidate anytime using the **Quick Switcher** in the navigation header.

---

## 6. Testing

### Run Backend Unit Tests
Run all unit tests covering task assignments, review score normalization, and email error handling:
```bash
python -m pytest tests
```

### Run Full End-to-End Integration Test
Run the complete workflow test verifying real LLM calls, mentor responses, document parsing, review report generation, and database updates:
```bash
python tests/test_e2e_workflow.py
```

---

## 7. Reminder Scheduler

The reminder scheduler is implemented in `backend/services/reminder_scheduler.py`:
- Automatically runs as a background thread on FastAPI startup (interval: 60 seconds).
- Identifies tasks with upcoming deadlines (within 24 hours) or reviews (within 4 hours).
- Avoids duplicate reminders by persisting records in the `reminder_records` table.
- Can also be run on-demand via the UI (**Audit Logs > Run Scheduler Scan Now**) or from the command line:
  ```bash
  python -m backend.services.reminder_scheduler
  ```

---

## 8. Verified Features

1. **Role-based Authentication**: Simple JWT authentication where candidates strictly only see their assigned tasks.
2. **Admin Dashboard**: Project creation, module creation, task assignment with tech stack, deliverables, submission deadline, and review date/time.
3. **Reference Document Extraction**: Automatic text extraction from uploaded PDF, DOCX, and TXT files using PyMuPDF and python-docx.
4. **AI Project Mentor**: 8-point initial guidance (meaning, features, prerequisites, step-by-step plan, architecture, testing, common errors, checklist) and interactive follow-up chat with conversation history stored in SQLite.
5. **AI Documentation Review**: Structured JSON evaluation with score (0-100), requirement-by-requirement verification status (`Met`, `Partially Met`, `Not Met`, `Unable to Verify`), strengths, gaps, and improvements. Multiple revisions are preserved.
6. **Email Notifications**: Gmail SMTP integration with persistent SQLite attempt logging (`email_logs` table) for assignment, review completion, and scheduled reminders.
7. **Clean, Responsive UI**: Built with React, Vite, Tailwind CSS v4, and Lucide icons.

