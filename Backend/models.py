from typing import Optional
from sqlmodel import Field, SQLModel

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: Optional[str] = None
    password_hash: Optional[str] = None
    target_wake_time: str      # 例: "07:00"
    target_bed_time: str       # 例: "23:00"
    coins: int = 0             # タスク達成で溜まるポイント/コイン

class Task(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = 1           # 簡易実装のためデフォルト1
    title: str
    category: Optional[str] = None
    status: str = "TODO"
    estimated_minutes: int = 15
    is_completed: bool = False
    recommended_qr: Optional[str] = None  # 例: "WASHROOM", "DESK"