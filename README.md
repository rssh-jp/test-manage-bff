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
- `PERSISTED_QUERIES_PATH`: Persisted Queries ファイルのパス（既定値: `src/persisted-documents.json`）

## API

### GraphQL（FE が利用するメインエンドポイント）

- `POST /api/graphql` — Static Persisted Queries のみ受け付ける GraphQL エンドポイント

FE は `codegen` で生成したドキュメントハッシュを使って `extensions.persistedQuery.sha256Hash` を送信します。
ハッシュなしの生クエリは拒否されます（Trusted Documents）。

### REST（内部用・後方互換）

- `GET /api/users?query=...` ユーザー一覧（検索対応）
- `GET /api/users/:id` ユーザー詳細
- `POST /api/users` ユーザー作成
- `PUT /api/users/:id` ユーザー更新
- `DELETE /api/users/:id` ユーザー削除
