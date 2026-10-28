from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Task, ChatMessage, User
from backend.schemas import ChatMessageOut, ChatMessageCreate
from backend.auth import get_current_user
from backend.services.ai_mentor import get_or_create_initial_guidance, send_followup_question

router = APIRouter(prefix="/tasks/{task_id}/mentor", tags=["AI Project Mentor"])

@router.get("/messages", response_model=List[ChatMessageOut])
async def get_chat_history_or_primer(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if current_user.role == "candidate" and task.assigned_candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # If no messages exist yet, generate the comprehensive 8-point primer
    messages = db.query(ChatMessage).filter(ChatMessage.task_id == task_id).order_by(ChatMessage.created_at.asc()).all()
    if not messages:
        try:
            await get_or_create_initial_guidance(task, db, current_user.id)
            messages = db.query(ChatMessage).filter(ChatMessage.task_id == task_id).order_by(ChatMessage.created_at.asc()).all()
        except Exception as e:
            # Fallback error message if LLM call fails
            err_msg = ChatMessage(
                task_id=task.id,
                user_id=current_user.id,
                sender_type="mentor",
                content=f"Welcome to the task! (Note: AI Mentor encountered an issue initializing: {str(e)}. Please check your LLM configuration or ask a question directly)."
            )
            db.add(err_msg)
            db.commit()
            messages = [err_msg]

    return messages

@router.post("/chat", response_model=ChatMessageOut)
async def chat_with_mentor_endpoint(
    task_id: int,
    payload: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if current_user.role == "candidate" and task.assigned_candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    try:
        reply = await send_followup_question(task, content, db, current_user.id)
        return reply
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Mentor Error: {str(e)}")

