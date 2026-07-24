from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session  # sqlalchemy.orm から sqlmodel に変更

# database.py から get_session をインポートするように修正
from database import get_session
from models import Task  # DBのTaskモデル

router = APIRouter()


# 1. リクエスト用のPydanticモデル（idを含めない）
class TaskCreate(BaseModel):
    user_id: int
    title: str
    category: str
    estimated_minutes: int
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
        estimated_minutes=task.estimated_minutes,
        is_completed=task.is_completed,
        recommended_qr=task.recommended_qr,
    )

    session.add(db_task)
    session.commit()
    session.refresh(db_task)  # 自動採番されたidなどを反映

    return db_task