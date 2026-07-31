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

    user = session.get(User, task.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if task.is_completed:
        return {
            "message": "Task already completed",
            "earned_coins": 0,
            "total_coins": user.coins,
        }

    task.is_completed = True
    task.status = "DONE"
    session.add(task)

    user.coins += 10
    session.add(user)
    session.commit()
    session.refresh(user)

    return {
        "message": "Task completed!",
        "earned_coins": 10,
        "total_coins": user.coins
    }


@router.get('/state')
def get_game_state(session: Session = Depends(get_session)):
    # Return a simple game state based on DB
    # For demo, return fixed values and inventory empty
    return {
        'level': 12,
        'xp': 1240,
        'streakDays': 7,
        'enemyName': '洞窟のゴブリン',
        'enemyHp': 380,
        'enemyMaxHp': 700,
        'inventory': [],
    }
