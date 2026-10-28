import time
import threading
from datetime import datetime, timedelta
from backend.database import SessionLocal
from backend.models import Task, ReminderRecord
from backend.services.email_service import send_reminder_email

_scheduler_running = False
_scheduler_thread = None

def check_and_dispatch_pending_reminders():
    """
    Scans active tasks, determines if deadline or review reminders are due,
    and sends them without duplication.
    """
    db = SessionLocal()
    now = datetime.utcnow()
    processed_count = 0

    try:
        active_tasks = db.query(Task).filter(
            Task.assigned_candidate_id.isnot(None),
            Task.status != "Completed"
        ).all()

        for task in active_tasks:
            if not task.assigned_candidate:
                continue

            # 1. Check Submission Deadline (trigger if deadline is within next 24 hours)
            if task.submission_deadline:
                # Within next 24 hours or up to 2 hours past deadline
                time_until_deadline = task.submission_deadline - now
                if timedelta(hours=-2) <= time_until_deadline <= timedelta(hours=24):
                    # Check if already sent
                    existing = db.query(ReminderRecord).filter(
                        ReminderRecord.task_id == task.id,
                        ReminderRecord.reminder_type == "deadline_reminder",
                        ReminderRecord.status == "SENT"
                    ).first()

                    if not existing:
                        reminder = ReminderRecord(
                            task_id=task.id,
                            reminder_type="deadline_reminder",
                            scheduled_for=task.submission_deadline,
                            status="PENDING"
                        )
                        db.add(reminder)
                        db.commit()

                        result = send_reminder_email(task, task.assigned_candidate, "deadline_reminder", db)
                        reminder.status = result.get("status", "FAILED")
                        reminder.sent_at = datetime.utcnow()
                        db.commit()
                        processed_count += 1

            # 2. Check Review Appointment (trigger if review is within next 4 hours)
            if task.review_datetime:
                time_until_review = task.review_datetime - now
                if timedelta(hours=-1) <= time_until_review <= timedelta(hours=4):
                    existing = db.query(ReminderRecord).filter(
                        ReminderRecord.task_id == task.id,
                        ReminderRecord.reminder_type == "review_reminder",
                        ReminderRecord.status == "SENT"
                    ).first()

                    if not existing:
                        reminder = ReminderRecord(
                            task_id=task.id,
                            reminder_type="review_reminder",
                            scheduled_for=task.review_datetime,
                            status="PENDING"
                        )
                        db.add(reminder)
                        db.commit()

                        result = send_reminder_email(task, task.assigned_candidate, "review_reminder", db)
                        reminder.status = result.get("status", "FAILED")
                        reminder.sent_at = datetime.utcnow()
                        db.commit()
                        processed_count += 1

    finally:
        db.close()

    return processed_count


def _scheduler_loop(interval_seconds: int = 60):
    global _scheduler_running
    while _scheduler_running:
        try:
            check_and_dispatch_pending_reminders()
        except Exception as e:
            print(f"[Scheduler Exception] {e}")
        time.sleep(interval_seconds)


def start_scheduler(interval_seconds: int = 60):
    global _scheduler_running, _scheduler_thread
    if not _scheduler_running:
        _scheduler_running = True
        _scheduler_thread = threading.Thread(target=_scheduler_loop, args=(interval_seconds,), daemon=True)
        _scheduler_thread.start()
        print(f"[Scheduler] Background reminder scheduler started (interval: {interval_seconds}s).")


def stop_scheduler():
    global _scheduler_running
    _scheduler_running = False


if __name__ == "__main__":
    print("Running on-demand reminder check...")
    count = check_and_dispatch_pending_reminders()
    print(f"Processed {count} due reminders.")

