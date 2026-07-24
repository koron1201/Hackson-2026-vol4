from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from database import get_session
from models import Task, User

router = APIRouter(prefix="/game", tags=["Game & Rewards (BE-1)"])

# タスク完了 & 報酬獲得 (コイン+10)
@router.post("/tasks/{task_id}/complete")
def complete_task(task_id: int, session: Session = Depends(get_session)):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task.is_completed = True
    session.add(task)
    
    user = session.get(User, task.user_id)
    if not user:
        user = User(id=1, name="Hero", target_wake_time="07:00", target_bed_time="23:00", coins=0)
        session.add(user)
    
    user.coins += 10
    session.add(user)
    session.commit()
    session.refresh(user)
    
    return {
        "message": "Task completed!",
        "earned_coins": 10,
        "total_coins": user.coins
    }