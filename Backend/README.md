# MorningQuest Backend

FastAPI と SQLite を使った開発用バックエンドです。

## 起動

```powershell
Set-Location Backend
$env:SECRET_KEY = "開発環境で生成した十分に長いランダム値"
$env:ALLOWED_ORIGINS = "http://localhost:5173"
uvicorn main:app --reload --port 8000
```

`OPENAI_API_KEY` が未設定の場合、AI分類はルールベースの候補へフォールバックします。
本番環境では `SECRET_KEY`、`ALLOWED_ORIGINS`、APIキーをシークレット管理へ登録してください。
