# 部・課管理機能 設計書

Date: 2026-04-01

## 概要

メンバーに「部」「課」の所属情報を追加し、部・課ごとの工数・コスト合算表示を実現する。
部と課は階層構造（課は特定の部に属する）を持つマスタデータとして管理する。

---

## データベーススキーマ

### 新規テーブル

```sql
-- 部
CREATE TABLE departments (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 課（部に属する）
CREATE TABLE sections (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  department_id INT UNSIGNED NOT NULL,
  name          VARCHAR(100) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);
```

### `members` テーブル変更

```sql
ALTER TABLE members
  ADD COLUMN section_id INT UNSIGNED NULL AFTER unit_cost,
  ADD FOREIGN KEY (section_id) REFERENCES sections(id);
```

- `section_id` は NULL 許容（部・課未所属メンバーを許容）
- 部の情報は `sections.department_id` を辿って取得（`members` には持たせない）
- 削除制約:
  - 部の削除: 所属する課が存在する場合はエラー（アプリ側でチェック）
  - 課の削除: 所属するメンバーが存在する場合はエラー（アプリ側でチェック）

---

## API設計

ベースパス: `/api/v1`

### 新規エンドポイント

#### 部（Departments）

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /departments | 部一覧（各部に属する課の配列を含む） |
| POST | /departments | 部の作成（body: `{ name: string }`） |
| PUT | /departments/:id | 部の更新（body: `{ name: string }`） |
| DELETE | /departments/:id | 部の削除（所属課あり時は 400 エラー） |

**GET /departments レスポンス例:**
```json
[
  {
    "id": 1,
    "name": "営業部",
    "sections": [
      { "id": 1, "name": "営業1課" },
      { "id": 2, "name": "営業2課" }
    ]
  }
]
```

#### 課（Sections）

| メソッド | パス | 説明 |
|---------|------|------|
| POST | /sections | 課の作成（body: `{ department_id: number, name: string }`） |
| PUT | /sections/:id | 課の更新（body: `{ name: string }`） |
| DELETE | /sections/:id | 課の削除（所属メンバーあり時は 400 エラー） |

### 既存エンドポイントの変更

#### GET /members

レスポンスの各メンバーに以下を追加:

```json
{
  "section_id": 1,
  "section_name": "営業1課",
  "department_id": 1,
  "department_name": "営業部"
}
```

未所属の場合は `null`。

#### POST /members, PUT /members/:id

リクエストボディに `section_id`（number | null）を受け付ける。

#### GET /reports/monthly

レスポンスのメンバー行に `section_id`, `section_name`, `department_id`, `department_name` を追加。

レスポンスに部・課別集計を追加:

```json
{
  "year": 2026,
  "month": 4,
  "members": [...],
  "department_summary": [
    {
      "department_id": 1,
      "department_name": "営業部",
      "total_planned_hours": 480,
      "total_actual_hours": 462,
      "total_planned_cost": 2400000,
      "total_actual_cost": 2310000,
      "sections": [
        {
          "section_id": 1,
          "section_name": "営業1課",
          "total_planned_hours": 320,
          "total_actual_hours": 308,
          "total_planned_cost": 1600000,
          "total_actual_cost": 1540000
        }
      ]
    }
  ]
}
```

#### GET /reports/annual

レスポンスに同様の部・課別集計（月別）を追加。

---

## フロントエンド

### 新規ファイル

| ファイル | 説明 |
|---------|------|
| `frontend/src/pages/DepartmentsPage.tsx` | 部・課管理UI（タブとして ConfigPage に統合） |
| `frontend/src/api/client.ts` | departments/sections APIコールを追加 |
| `frontend/src/types/index.ts` | Department, Section, DepartmentSummary 型を追加 |

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/pages/ConfigPage.tsx` | 「システム設定」「部・課管理」タブに分割 |
| `frontend/src/pages/MembersPage.tsx` | テーブルに部・課列追加、フォームにセレクトボックス追加、部・課別集計テーブル追加 |
| `frontend/src/pages/ReportPage.tsx` | 「部・課別」タブ追加 |

### 部・課管理UI（ConfigPage内タブ）

```
[システム設定] [部・課管理]

[+ 部を追加]

▼ 営業部          [編集] [削除]
    └ 営業1課      [編集] [削除]
    └ 営業2課      [編集] [削除]
    └ [+ 課を追加]

▼ 開発部          [編集] [削除]
    └ ...
```

- 編集はインライン編集（既存 ConfigPage パターンと統一）
- 削除時に所属データがある場合、エラーメッセージをインライン表示

### メンバー管理ページ（/members）

**メンバー一覧テーブル列追加:**
```
コード | メンバー名 | 部 | 課 | 単価 | 在籍 | 操作
```

**新規追加・編集フォーム:**
- 部セレクトボックス（未所属を含む）
- 課セレクトボックス（選択した部に属する課のみ表示、未所属を含む）

**部・課別集計テーブル（既存コストサマリーの下）:**

| 部 | 課 | メンバー数 | 予定工数合計 | 実績工数合計 | 実績コスト合計 |
|---|---|---|---|---|---|
| 営業部 | (合計) | 3 | 480h | 462h | 2,310,000円 |
|  | 営業1課 | 2 | 320h | 308h | 1,540,000円 |
|  | 営業2課 | 1 | 160h | 154h | 770,000円 |

- 集計対象月は年月セレクタで選択（ダッシュボードの年月セレクタと独立）

### 工数レポートページ（/report）

月次・年次タブに加えて「部・課別」タブを追加:

```
[月次] [年次] [部・課別]
```

- 部・課別タブ: 年月セレクタ + 部・課別集計テーブル（MembersPageと同形式）
- データは `/reports/monthly` の `department_summary` を使用

---

## バックエンドファイル

| ファイル | 変更種別 |
|---------|---------|
| `backend/src/routes/departments.ts` | 新規作成 |
| `backend/src/routes/members.ts` | section_id 対応 |
| `backend/src/routes/reports.ts` | 部・課別集計追加 |
| `backend/src/index.ts` | departments ルート登録 |
| `backend/src/types/index.ts` | Department, Section 型追加 |
| `db/init/01_schema.sql` | departments, sections テーブル追加、members 変更 |
