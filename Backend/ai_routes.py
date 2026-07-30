import json
import os
from fastapi import APIRouter
from pydantic import BaseModel, Field
from openai import OpenAI

router = APIRouter(prefix="/ai", tags=["AI Integration (BE-2)"])

class AIAnalyzeRequest(BaseModel):
    task_title: str = Field(min_length=1, max_length=120)

@router.post("/analyze-task")
def analyze_task(req: AIAnalyzeRequest):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {
            "category": "習慣",
            "estimated_minutes": 10,
            "recommended_qr": "WASHROOM",
            "note": "OPENAI_API_KEY未設定のためモック応答です"
        }

    client = OpenAI(api_key=api_key)
    prompt = f"""
    以下のタスクについて、適切なカテゴリ、予想される所要時間（分）、および設置すべきおすすめのQRコード名（WASHROOM, DESK, ENTRANCE など）を提案してください。

    タスク名: {req.task_title}

    以下のJSONフォーマットのみで返答してください:
    {{
      "category": "カテゴリ名",
      "estimated_minutes": 所要時間(数値),
      "recommended_qr": "推奨QRコード識別子"
    }}
    """
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        result = json.loads(response.choices[0].message.content)
        return result
    except Exception:
        return {
            "category": "その他",
            "estimated_minutes": 15,
            "recommended_qr": "DESK",
            "note": "AI分析に失敗したためルールベースの候補を返しました"
        }
