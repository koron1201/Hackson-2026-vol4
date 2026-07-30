from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/qr", tags=["QR Verification (BE-2)"])

class QRCheckRequest(BaseModel):
    scanned_qr_code: str = Field(min_length=1, max_length=128)
    target_qr_code: str = Field(min_length=1, max_length=128)

@router.post("/verify")
def verify_qr(req: QRCheckRequest):
    is_valid = req.scanned_qr_code.strip() == req.target_qr_code.strip()

    if is_valid:
        return {"success": True, "message": "QRコード一致！アラームを解除・タスクを着手します。"}
    else:
        return {"success": False, "message": "QRコードが一致しません。"}


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
