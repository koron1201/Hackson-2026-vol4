from fastapi import APIRouter
from pydantic import BaseModel

import os
import qrcode
from fastapi.responses import FileResponse
from fastapi import HTTPException

from sqlmodel import Session, select
from fastapi import Depends
from database import get_session
from models import Task

router = APIRouter(prefix="/qr", tags=["QR Verification (BE-2)"])

class QRCheckRequest(BaseModel):
    scanned_qr_code: str
    # target_qr_code: str

class QRCreateRequest(BaseModel):
    qr_name: str

@router.post("/create")
def create_qr(req: QRCreateRequest):
    os.makedirs("qr_codes", exist_ok=True)
    img = qrcode.make(req.qr_name)
    file_path = f"qr_codes/{req.qr_name}.png"
    img.save(file_path)
    return {
        "message": "QRコードを生成しました",
        "file_name": f"{req.qr_name}.png"
    }

@router.get("/{qr_name}")
def get_qr(qr_name: str):
    file_path = f"qr_codes/{qr_name}.png"
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail="QRコードが見つかりません"
        )
    return FileResponse(file_path, media_type="image/png")

@router.post("/verify")
def verify_qr(
    req: QRCheckRequest,
    session: Session = Depends(get_session)
):
    # QRコードに対応するタスクを検索
    statement = select(Task).where(
        Task.recommended_qr == req.scanned_qr_code
    )
    tasks = session.exec(statement).all()
    # 対応するタスクがない場合
    if not tasks:
        return {
            "success": False,
            "alarm_released": False,
            "message": "このQRコードに対応するタスクはありません。"
        }
    # タスクを開始状態に変更（未完了のものだけ）
    started_tasks = []
    for task in tasks:
        if not task.is_completed:
            task.status = "IN_PROGRESS"
            session.add(task)
            started_tasks.append({
                "id": task.id,
                "title": task.title,
                "category": task.category,
                "estimated_minutes": task.estimated_minutes
            })
    session.commit()
    return {
        "success": True,
        "alarm_released": True,
        "message": "QRコードを認識しました。タスクを開始します。",
        "tasks": started_tasks
    }


# compatibility endpoint for frontend /scans/verify
@router.post('/scans/verify')
def verify_scan(payload: dict):
    # frontend sends: rawToken, taskId, purpose, scannedAt, clientEventId
    raw = payload.get('rawToken') or payload.get('scanned_qr_code')
    task_id = payload.get('taskId')
    # simple logic: accept if raw is non-empty
    verified = bool(raw)
    # return a minimal task object when verified
    task = None
    if task_id:
        task = { 'id': task_id, 'title': 'タスク', 'status': 'STARTED' }
    return { 'verified': verified, 'task': task }