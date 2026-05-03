# test-manage-bff

BE と FE の間をつなぐ BFF です。TypeScript + Fastify で実装しています。

## 起動

```bash
npm install
npm run dev
```

デフォルトで `http://localhost:8081` で起動します。

## 環境変数

- `PORT`: BFF の待受ポート（既定値: `8081`）
- `BE_BASE_URL`: BE のURL（既定値: `http://localhost:8080`）

## API

- `GET /api/users?query=...` ユーザー一覧（検索対応）
- `GET /api/users/:id` ユーザー詳細
- `PUT /api/users/:id` ユーザー更新
