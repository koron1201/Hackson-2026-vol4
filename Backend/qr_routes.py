from fastapi import APIRouter
from pydantic import BaseModel, Field

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
    scanned_qr_code: str = Field(min_length=1, max_length=128)

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
        "file_name": f"{req.qr_name}.png",
        "url": f"/qr/{req.qr_name}"
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
        Task.recommended_qr == req.scanned_qr_code,
        Task.is_completed == False
    )
    tasks = session.exec(statement).all()

    if not tasks:
        return {
            "success": False,
            "alarm_released": False,
            "message": "開始できるタスクはありません。"
        }
    started_tasks = []
    for task in tasks:
        task.status = "STARTED"
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
class ScanVerifyRequest(BaseModel):
    rawToken: str = Field(min_length=1, max_length=128)
    taskId: str = Field(min_length=1, max_length=64)
    purpose: str = Field(min_length=1, max_length=32)
    targetQrCode: str | None = Field(default=None, min_length=1, max_length=128)


@router.post('/scans/verify')
def verify_scan(payload: ScanVerifyRequest):
    # A non-empty QR value alone is not proof of a valid scan.
    raw = payload.rawToken.strip()
    task_id = payload.taskId
    verified = bool(payload.targetQrCode) and raw == payload.targetQrCode.strip()
    # return a minimal task object when verified
    task = None
    if task_id:
        task = { 'id': task_id, 'title': 'タスク', 'status': 'STARTED' }
    return {'verified': verified, 'task': task if verified else None}
