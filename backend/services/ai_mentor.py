from sqlalchemy.orm import Session
from backend.models import Task, ChatMessage, TaskReferenceDoc
from backend.services.llm_service import call_llm

def build_task_context(task: Task, db: Session) -> str:
    """
    Constructs comprehensive task context including reference docs for AI Mentor and Reviewer.
    """
    ref_docs = db.query(TaskReferenceDoc).filter(TaskReferenceDoc.task_id == task.id).all()
    ref_text = ""
    if ref_docs:
        ref_text = "\n\n--- REFERENCE DOCUMENTS ---\n"
        for doc in ref_docs:
            snippet = (doc.extracted_text or "").strip()
            if len(snippet) > 2500:
                snippet = snippet[:2500] + "\n...[truncated for token economy]..."
            ref_text += f"\n[Document: {doc.filename}]\n{snippet}\n"

    deadline_str = task.submission_deadline.strftime("%Y-%m-%d %H:%M UTC") if task.submission_deadline else "Not specified"
    review_str = task.review_datetime.strftime("%Y-%m-%d %H:%M UTC") if task.review_datetime else "Not specified"

    context = f"""
TASK SPECIFICATION:
- Title: {task.title}
- Technology Stack: {task.tech_stack or 'Standard modern stack'}
- Submission Deadline: {deadline_str}
- Scheduled Review Date/Time: {review_str}
- Passing Score: {task.passing_score}/100

DESCRIPTION & OBJECTIVES:
{task.description}

REQUIRED DELIVERABLES & ACCEPTANCE CRITERIA:
{task.deliverables or 'Adhere strictly to project requirements.'}
{ref_text}
"""
    return context.strip()


async def get_or_create_initial_guidance(task: Task, db: Session, user_id: int) -> ChatMessage:
    """
    If no messages exist for this task, automatically generates the comprehensive 8-point
    kickoff guidance from the AI Mentor and stores it in the database.
    """
    existing_messages = db.query(ChatMessage).filter(ChatMessage.task_id == task.id).order_by(ChatMessage.created_at.asc()).all()
    if existing_messages:
        return existing_messages[0]

    task_context = build_task_context(task, db)

    system_prompt = (
        "You are an expert AI Technical Project Mentor. Your goal is to guide candidates step-by-step "
        "to succeed on their assigned engineering task. Communicate clearly, professionally, and encouragingly. "
        "Provide concrete, actionable technical advice avoiding unnecessary jargon."
    )

    user_prompt = f"""
Here is the task context assigned to the candidate:

{task_context}

Please provide an in-depth kickoff guidance covering exactly these 8 areas:
1. What the task means (high-level objective & context)
2. What needs to be built (key features & functional requirements)
3. Required concepts and prerequisites
4. Step-by-step implementation plan (phased approach)
5. Suggested architecture and database design (schema & components where relevant)
6. Testing and validation steps (how to verify it works)
7. Common errors and how to fix them
8. Final submission checklist (documentation & delivery requirements)

Structure your response clearly with headings for each of the 8 points. Keep it clear, practical, and directly aligned with the required tech stack and deliverables.
"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    mentor_reply = await call_llm(messages, max_tokens=2200, temperature=0.3)

    initial_msg = ChatMessage(
        task_id=task.id,
        user_id=user_id,
        sender_type="mentor",
        content=mentor_reply
    )
    db.add(initial_msg)
    db.commit()
    db.refresh(initial_msg)
    return initial_msg


async def send_followup_question(task: Task, candidate_message: str, db: Session, user_id: int) -> ChatMessage:
    """
    Sends a follow-up question to the AI Mentor, passing conversational history and task context.
    """
    # Save candidate message
    user_msg = ChatMessage(
        task_id=task.id,
        user_id=user_id,
        sender_type="candidate",
        content=candidate_message
    )
    db.add(user_msg)
    db.commit()

    # Retrieve recent chat history for context (up to last 10 messages for token economy)
    history = db.query(ChatMessage).filter(ChatMessage.task_id == task.id).order_by(ChatMessage.created_at.asc()).all()
    recent_history = history[-10:]

    task_context = build_task_context(task, db)
    system_prompt = (
        "You are an expert AI Technical Project Mentor assisting the candidate with their task.\n"
        f"TASK CONTEXT:\n{task_context}\n\n"
        "Answer candidate follow-up questions accurately, constructively, and concisely. "
        "Refer back to the task specifications, technology stack, and acceptance criteria."
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in recent_history:
        role = "assistant" if msg.sender_type == "mentor" else "user"
        messages.append({"role": role, "content": msg.content})

    mentor_reply = await call_llm(messages, max_tokens=1500, temperature=0.3)

    mentor_msg = ChatMessage(
        task_id=task.id,
        user_id=user_id,
        sender_type="mentor",
        content=mentor_reply
    )
    db.add(mentor_msg)
    db.commit()
    db.refresh(mentor_msg)
    return mentor_msg

