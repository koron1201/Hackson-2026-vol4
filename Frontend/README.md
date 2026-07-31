# MorningQuest Frontend

Vue 3、TypeScript、Viteで構築したモバイルファーストのWebフロントエンドです。

## 開発

```sh
npm install
npm run dev
```

### バックエンド接続モード

`backend` ブランチのFastAPIを起動し、`.env.example`を`.env.local`へコピーしてから
フロントエンドを起動します。

```sh
# Backendディレクトリ（バックエンド側で必要パッケージを導入済みの環境）
uvicorn main:app --reload --port 8000

# Frontendディレクトリ
Copy-Item .env.example .env.local
npm run dev
```

```text
VITE_API_BASE_URL=http://localhost:8000
```

接続先を設定した場合、固定デモタスクは読み込まず、次の現行バックエンドAPIを使用します。

| フロント操作 | バックエンドAPI |
|---|---|
| 接続確認 | `GET /` |
| ログイン・利用者検証 | `POST /auth/login` → `GET /auth/me` |
| タスク追加 | `POST /ai/analyze-task` → `POST /tasks` |
| QR照合 | `POST /qr/verify` |
| タスク完了・コイン付与 | `POST /game/tasks/{task_id}/complete` |

アクセストークンはメモリ内だけに保持し、ブラウザの永続ストレージには保存しません。
ページを再読み込みすると再ログインが必要です。クライアントのルートガードは画面遷移を
制御するだけであり、バックエンドでの認証・所有者認可の代わりにはなりません。

現行バックエンドにはプラン保存・バトル実行を含む開発用ルートがありますが、
認証・所有者認可を含む本番向け API 契約は未完成です。
タスク追加は固定ユーザー ID `1` を使用するため、API 接続モードは開発確認用途に限定してください。

`.env.local`がない場合は、バックエンドへ送信しないローカルデモとして起動します。

## 検証

```sh
npm run test
npm run test:coverage
npm run lint
npm run typecheck
npm run build
```

ブラウザのカメラは `localhost` またはHTTPSでのみ利用できます。ローカルデモでは
スキャナー画面の「デモ用QRで続ける」からカメラなしでも主要フローを確認できます。
バックエンド接続モードのQR内容は、現行APIに合わせて `WASHROOM`、`DESK`、
`ENTRANCE` のいずれかです。カメラ映像は送信せず、読み取った文字列だけを照合APIへ送ります。
