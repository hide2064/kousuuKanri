# CSV取込拡張（部・課マスタ／メンバー）設計書

## 概要

ImportPage に「部・課マスタ」「メンバー」の2つのCSV取込タイプを追加する。
既存の「工数」取込はそのまま維持し、ImportPage をタブ形式に変更する。

---

## CSVフォーマット

### 部・課マスタCSV

| 列 | 必須 | 説明 |
|----|------|------|
| `department_name` | ✓ | 部名。空欄の行はスキップ（エラー記録） |
| `section_name` | — | 空欄なら部だけ登録。値があれば該当部に課をUPSERT |

```csv
department_name,section_name
テクノロジー本部,プラットフォーム開発課
テクノロジー本部,SRE課
テクノロジー本部,
ビジネス本部,営業企画課
```

**UPSERT戦略：**
- 部：`departments.name` で UNIQUE 判定 → 既存なら無視（`INSERT IGNORE`）
- 課：`(department_id, name)` の組み合わせで UNIQUE 判定 → 既存なら無視

### メンバーCSV

| 列 | 必須 | 説明 |
|----|------|------|
| `member_code` | ✓ | UPSERTのキー |
| `member_name` | ✓ | 氏名 |
| `unit_cost` | — | 単価（円/時間）。省略時は 0 |
| `department_name` | — | 空欄なら所属なし（section_id = NULL） |
| `section_name` | — | `department_name` と組み合わせて section_id を解決 |

```csv
member_code,member_name,unit_cost,department_name,section_name
M001,田中太郎,5000,テクノロジー本部,プラットフォーム開発課
M002,山田花子,5500,,
M003,佐藤次郎,4800,テクノロジー本部,
```

**UPSERT戦略：**
- `member_code` で `INSERT ... ON DUPLICATE KEY UPDATE name, unit_cost, section_id`
- `department_name` + `section_name` 両方指定 → DBを検索して `section_id` を解決
- `department_name` のみ（`section_name` 空） → `section_id = NULL`
- 部名または課名がDBに存在しない → その行をエラーとしてスキップ

---

## バックエンド

### 新規ファイル

| ファイル | 内容 |
|---------|------|
| `backend/src/routes/importDepartments.ts` | 部・課マスタ取込ルート |
| `backend/src/routes/importMembers.ts` | メンバー取込ルート |

### エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/v1/import/departments` | 部・課マスタCSV取込 |
| POST | `/api/v1/import/members` | メンバーCSV取込 |

いずれも `multipart/form-data` で `file` フィールドにCSVを受け取る。
multer の設定（5MB制限、memoryStorage）は既存と同一。

### レスポンス形式（既存 `ImportResult` 型と統一）

```json
{
  "total": 7,
  "imported": 6,
  "skipped": 1,
  "errors": [
    { "row": 3, "reason": "部名が見つかりません: XX部" }
  ]
}
```

### `backend/src/index.ts` への追加

```typescript
import importDepartmentsRouter from './routes/importDepartments';
import importMembersRouter     from './routes/importMembers';

app.use('/api/v1/import/departments', importDepartmentsRouter);
app.use('/api/v1/import/members',     importMembersRouter);
```

### DBスキーマ変更

UPSERT実現のため以下の UNIQUE KEY を追加：

```sql
ALTER TABLE departments ADD UNIQUE KEY uq_department_name (name);
ALTER TABLE sections    ADD UNIQUE KEY uq_section_dept_name (department_id, name);
```

`db/init/01_schema.sql` にも同様に追記し、初回構築時にも反映されるようにする。

### エラーハンドリング方針

- 行単位のエラーは `errors[]` に収集し、他の行の処理は続行（既存工数取込と同じ）
- ファイル未添付・パースエラーは 400 を返す
- DB例外は行エラーとして記録

---

## フロントエンド

### ImportPage タブ構成

```
[工数] [部・課マスタ] [メンバー]
```

各タブの共通構成（現在の工数タブと同じパターン）：
1. CSVフォーマット仕様（サンプルCSV付き）
2. ドラッグドロップ／ファイル選択エリア
3. 取込実行ボタン
4. 取込結果（総行数・成功・スキップ・エラー詳細）

### `frontend/src/api/client.ts` への追加

```typescript
importDepartmentsCsv: (file: File) => req<ImportResult>('/import/departments', { method: 'POST', body: (() => { const f = new FormData(); f.append('file', file); return f; })() })
importMembersCsv:     (file: File) => req<ImportResult>('/import/members',     { method: 'POST', body: (() => { const f = new FormData(); f.append('file', file); return f; })() })
```

### キャッシュ無効化

| タブ | 取込成功後に invalidate するキー |
|------|-------------------------------|
| 部・課マスタ | `['departments']` |
| メンバー | `['members']`, `['departments']` |

### 変更ファイル

| ファイル | 変更種別 |
|---------|---------|
| `frontend/src/pages/ImportPage.tsx` | 変更（3タブ化） |
| `frontend/src/api/client.ts` | 変更（API2本追加） |

---

## 実装ファイル一覧

| ファイル | 変更種別 |
|---------|---------|
| `db/init/01_schema.sql` | 変更（UNIQUE KEY追加） |
| `backend/src/routes/importDepartments.ts` | 新規 |
| `backend/src/routes/importMembers.ts` | 新規 |
| `backend/src/index.ts` | 変更（ルート登録） |
| `frontend/src/api/client.ts` | 変更（API追加） |
| `frontend/src/pages/ImportPage.tsx` | 変更（タブ化） |
