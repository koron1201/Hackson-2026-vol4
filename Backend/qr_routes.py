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