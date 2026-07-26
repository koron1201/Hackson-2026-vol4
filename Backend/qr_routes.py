from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/qr", tags=["QR Verification (BE-2)"])

class QRCheckRequest(BaseModel):
    scanned_qr_code: str
    target_qr_code: str

@router.post("/verify")
def verify_qr(req: QRCheckRequest):
    is_valid = (req.scanned_qr_code.strip() == req.target_qr_code.strip())
    
    if is_valid:
        return {"success": True, "message": "QRコード一致！アラームを解除・タスクを着手します。"}
    else:
        return {"success": False, "message": "QRコードが一致しません。"}


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