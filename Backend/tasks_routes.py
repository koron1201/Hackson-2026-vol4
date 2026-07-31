from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session  # sqlalchemy.orm から sqlmodel に変更

# database.py から get_session をインポートするように修正
from database import get_session
from models import Task  # DBのTaskモデル

router = APIRouter()


@router.patch("/tasks/{task_id}/status")
def update_task_status(task_id: str, payload: dict, session: Session = Depends(get_session)):
    # Accept numeric DB ids or client-side demo string ids
    db_task = None
    try:
        int_id = int(task_id)
        db_task = session.get(Task, int_id)
    except Exception:
        db_task = None

    if db_task:
        status = payload.get('status')
        # Persist task progress so reloads keep STARTED/DONE.
        if status == 'STARTED':
            db_task.status = 'STARTED'
            db_task.is_completed = False
            session.add(db_task)
            session.commit()
            session.refresh(db_task)
            return {
                'id': db_task.id,
                'title': db_task.title,
                'category': db_task.category,
                'status': 'STARTED',
                'estimated_minutes': db_task.estimated_minutes,
                'recommended_qr': db_task.recommended_qr,
            }

        # If client marks DONE, persist completion
        if status == 'DONE':
            db_task.status = 'DONE'
            db_task.is_completed = True
            session.add(db_task)
            session.commit()
            session.refresh(db_task)
            return {
                'id': db_task.id,
                'title': db_task.title,
                'category': db_task.category,
                'status': 'DONE',
                'estimated_minutes': db_task.estimated_minutes,
                'recommended_qr': db_task.recommended_qr,
            }

        # default: return current persisted status
        return {
            'id': db_task.id,
            'title': db_task.title,
            'category': db_task.category,
            'status': db_task.status if db_task.status in {'TODO', 'STARTED', 'DONE'} else ('DONE' if db_task.is_completed else 'TODO'),
            'estimated_minutes': db_task.estimated_minutes,
            'recommended_qr': db_task.recommended_qr,
        }

    # Non-DB (demo) task: echo back a minimal task representation so frontend can continue
    status = payload.get('status')
    resp_status = 'DONE' if status == 'DONE' else ('STARTED' if status == 'STARTED' else 'TODO')
    return {
        'id': task_id,
        'title': payload.get('title', 'Untitled'),
        'category': payload.get('category', ''),
        'status': resp_status,
        'estimated_minutes': payload.get('estimated_minutes', 0),
        'recommended_qr': payload.get('recommended_qr', None),
    }


# DELETE /tasks/{task_id}
@router.delete("/tasks/{task_id}")
def delete_task(task_id: str, session: Session = Depends(get_session)):
    # Support deleting DB tasks by numeric id, or accept client-only demo ids
    try:
        int_id = int(task_id)
        db_task = session.get(Task, int_id)
        if not db_task:
            raise HTTPException(status_code=404, detail="Task not found")
        session.delete(db_task)
        session.commit()
        return {"status": "deleted"}
    except ValueError:
        # Non-numeric id: treat as client-only demo task; acknowledge deletion
        return {"status": "deleted"}


# 1. リクエスト用のPydanticモデル（idを含めない）
class TaskCreate(BaseModel):
    user_id: Optional[int] = 1
    title: str = Field(min_length=1, max_length=120)
    category: Optional[str] = Field(default=None, max_length=32)
    estimated_minutes: int = Field(default=15, ge=1, le=1440)
    is_completed: bool = False
    recommended_qr: Optional[str] = None


# 2. タスク作成エンドポイント
@router.post("/tasks")
def create_task(task: TaskCreate, session: Session = Depends(get_session)):
    # リクエストデータからDBモデルのインスタンスを作成（idは自動採番される）
    db_task = Task(
        user_id=task.user_id,
        title=task.title,
        category=task.category,
        status='TODO',
        estimated_minutes=task.estimated_minutes,
        is_completed=task.is_completed,
        recommended_qr=task.recommended_qr,
    )

    session.add(db_task)
    session.commit()
    session.refresh(db_task)  # 自動採番されたidなどを反映

    return db_task
