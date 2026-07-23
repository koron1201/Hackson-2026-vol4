# MorningQuest Frontend

Vue 3、TypeScript、Viteで構築したモバイルファーストのWebフロントエンドです。

## 開発

```sh
npm install
npm run dev
```

現在はバックエンド未接続でも画面と主要操作を確認できるローカルデモ状態で起動します。
設計書の `/v1` 契約に沿った薄いクライアントは `src/services/apiClient.ts` に用意しています。
バックエンド統合時は `.env.local` に接続先を設定し、Piniaの各actionから同クライアントを
呼び出してください。

```text
VITE_API_BASE_URL=http://localhost:3000/v1
```

## 検証

```sh
npm run test
npm run test:coverage
npm run lint
npm run typecheck
npm run build
```

ブラウザのカメラは `localhost` またはHTTPSでのみ利用できます。モックモードでは
スキャナー画面の「デモ用QRで続ける」からカメラなしでも主要フローを確認できます。
