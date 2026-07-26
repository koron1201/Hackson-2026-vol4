from fastapi import APIRouter, Depends
from typing import List
from sqlmodel import Session, select
from database import get_session
from models import Task

router = APIRouter()


@router.get("/plans/{local_date}")
def get_plan(local_date: str, session: Session = Depends(get_session)):
    # Return a simple daily plan with tasks from DB
    stmt = select(Task)
    tasks = session.exec(stmt).all()
    plan_tasks = []
    for t in tasks:
        plan_tasks.append(
            {
                "id": str(t.id),
                "title": t.title,
                "taskType": "DAILY",
                "category": t.category,
                "status": "DONE" if t.is_completed else "TODO",
                "estimated_minutes": t.estimated_minutes,
                "recommended_qr": t.recommended_qr,
            }
        )

    return {
        "localDate": local_date,
        "wakeTime": "07:00",
        "sleepTime": "23:30",
        "version": 1,
        "tasks": plan_tasks,
    }


@router.put("/plans/{local_date}")
def save_plan(local_date: str, plan: dict):
    # Accept and echo back the plan
    return plan
