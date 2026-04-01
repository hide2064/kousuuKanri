# 部・課管理機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** メンバーに部・課の所属情報を追加し、部・課ごとの工数・コスト集計をメンバー管理ページと工数レポートページに表示する。

**Architecture:** departments/sections を独立テーブルで管理（sections が departments に属する階層構造）。members に section_id を追加し JOIN で部・課情報を取得。月次レポートのレスポンスに department_summary を追加し、フロントエンドで再利用する。

**Tech Stack:** MySQL 8 / Express+TypeScript / React+TypeScript / TanStack Query / Tailwind CSS

---

## ファイル構成

| ファイル | 変更種別 | 内容 |
|---------|---------|------|
| `db/init/01_schema.sql` | 変更 | departments, sections テーブル追加 / members.section_id 追加 |
| `backend/src/types/index.ts` | 変更 | Department, Section 型追加 |
| `backend/src/routes/departments.ts` | 新規 | 部・課 CRUD |
| `backend/src/routes/members.ts` | 変更 | section_id 対応 (GET JOIN / POST / PUT) |
| `backend/src/routes/reports.ts` | 変更 | メンバー行に部・課情報追加 / department_summary 追加 |
| `backend/src/index.ts` | 変更 | departments ルート登録 |
| `frontend/src/types/index.ts` | 変更 | Department, Section, DepartmentSummary 型追加 / Member/MonthlyReport 更新 |
| `frontend/src/api/client.ts` | 変更 | departments/sections API 追加 |
| `frontend/src/pages/ConfigPage.tsx` | 変更 | タブ追加（システム設定 / 部・課管理） |
| `frontend/src/components/DepartmentsTab.tsx` | 新規 | 部・課管理UI |
| `frontend/src/pages/MembersPage.tsx` | 変更 | 部・課列 / フォームセレクト / 部・課別集計テーブル |
| `frontend/src/pages/ReportPage.tsx` | 変更 | 部・課別タブ追加 |

---

## Task 1: DBスキーマ変更

**Files:**
- Modify: `db/init/01_schema.sql`

- [ ] **Step 1: departments / sections テーブルと members.section_id を追加**

`db/init/01_schema.sql` の既存 `members` テーブル定義の直後（`work_hours` の前）に追加し、`members` テーブルの `unit_cost` カラムの後に `section_id` を追加:

```sql
CREATE TABLE IF NOT EXISTS departments (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sections (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  department_id INT UNSIGNED  NOT NULL,
  name          VARCHAR(100)  NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);
```

`members` テーブル定義を以下に変更（`section_id` カラムと FK を追加）:

```sql
CREATE TABLE IF NOT EXISTS members (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code       VARCHAR(50)   NOT NULL UNIQUE COMMENT 'メンバーコード',
  name       VARCHAR(100)  NOT NULL COMMENT '氏名',
  unit_cost  DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '単価（円/時間）',
  section_id INT UNSIGNED  DEFAULT NULL COMMENT '課ID',
  active     TINYINT(1)    NOT NULL DEFAULT 1 COMMENT '在籍フラグ',
  created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (section_id) REFERENCES sections(id)
);
```

- [ ] **Step 2: DBを再構築して確認**

```bash
docker-compose down -v
docker-compose up --build -d
docker-compose exec db mysql -u root -proot kousuu_kanri -e "SHOW TABLES;"
```

期待出力:
```
config
departments
members
sections
work_hours
```

- [ ] **Step 3: コミット**

```bash
git add db/init/01_schema.sql
git commit -m "feat: add departments and sections tables, add section_id to members"
```

---

## Task 2: バックエンド型定義更新

**Files:**
- Modify: `backend/src/types/index.ts`

- [ ] **Step 1: Department / Section 型を追加**

`backend/src/types/index.ts` を以下に置き換え:

```typescript
export interface Member {
  id: number;
  code: string;
  name: string;
  unit_cost: number;
  section_id: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: number;
  name: string;
  sections: Section[];
}

export interface Section {
  id: number;
  department_id: number;
  name: string;
}

export interface WorkHours {
  id: number;
  member_id: number;
  year: number;
  month: number;
  planned_hours: number | null;
  actual_hours: number | null;
  note: string | null;
}

export interface ConfigRow {
  config_key: string;
  config_value: string;
  description: string | null;
}

export interface MonthlyReportRow {
  id: number;
  code: string;
  name: string;
  unit_cost: number;
  section_id: number | null;
  section_name: string | null;
  department_id: number | null;
  department_name: string | null;
  planned_hours: number | null;
  actual_hours: number | null;
  note: string | null;
  missingPlanned: boolean;
  planned_cost: number | null;
  actual_cost: number | null;
}

export interface SectionSummary {
  section_id: number;
  section_name: string;
  member_count: number;
  total_planned_hours: number;
  total_actual_hours: number;
  total_planned_cost: number;
  total_actual_cost: number;
}

export interface DepartmentSummary {
  department_id: number;
  department_name: string;
  member_count: number;
  total_planned_hours: number;
  total_actual_hours: number;
  total_planned_cost: number;
  total_actual_cost: number;
  sections: SectionSummary[];
}
```

- [ ] **Step 2: コミット**

```bash
git add backend/src/types/index.ts
git commit -m "feat: add Department, Section, DepartmentSummary types to backend"
```

---

## Task 3: departments ルート作成

**Files:**
- Create: `backend/src/routes/departments.ts`

- [ ] **Step 1: departments.ts を作成**

```typescript
import { Router } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../db';

const router = Router();

// GET /api/v1/departments — 部一覧（課を含む）
router.get('/', async (req, res, next) => {
  try {
    const [deptRows] = await pool.query<RowDataPacket[]>(
      'SELECT id, name FROM departments ORDER BY name'
    );
    const [secRows] = await pool.query<RowDataPacket[]>(
      'SELECT id, department_id, name FROM sections ORDER BY name'
    );
    const result = deptRows.map(d => ({
      id: d.id,
      name: d.name,
      sections: secRows.filter(s => s.department_id === d.id).map(s => ({
        id: s.id,
        department_id: s.department_id,
        name: s.name,
      })),
    }));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/departments — 部の作成
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body as { name: string };
    if (!name) {
      res.status(400).json({ error: 'name は必須です' });
      return;
    }
    const [result] = await pool.query(
      'INSERT INTO departments (name) VALUES (?)',
      [name]
    );
    const id = (result as any).insertId;
    res.status(201).json({ id, name, sections: [] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/departments/:id — 部の更新
router.put('/:id', async (req, res, next) => {
  try {
    const { name } = req.body as { name: string };
    if (!name) {
      res.status(400).json({ error: 'name は必須です' });
      return;
    }
    await pool.query('UPDATE departments SET name = ? WHERE id = ?', [name, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/departments/:id — 部の削除（所属課あり時はエラー）
router.delete('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as cnt FROM sections WHERE department_id = ?',
      [req.params.id]
    );
    if ((rows[0] as any).cnt > 0) {
      res.status(400).json({ error: 'この部に所属する課が存在します。先に課を削除してください。' });
      return;
    }
    await pool.query('DELETE FROM departments WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/sections — 課の作成
router.post('/sections', async (req, res, next) => {
  try {
    const { department_id, name } = req.body as { department_id: number; name: string };
    if (!department_id || !name) {
      res.status(400).json({ error: 'department_id と name は必須です' });
      return;
    }
    const [result] = await pool.query(
      'INSERT INTO sections (department_id, name) VALUES (?, ?)',
      [department_id, name]
    );
    const id = (result as any).insertId;
    res.status(201).json({ id, department_id, name });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/sections/:id — 課の更新
router.put('/sections/:id', async (req, res, next) => {
  try {
    const { name } = req.body as { name: string };
    if (!name) {
      res.status(400).json({ error: 'name は必須です' });
      return;
    }
    await pool.query('UPDATE sections SET name = ? WHERE id = ?', [name, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/sections/:id — 課の削除（所属メンバーあり時はエラー）
router.delete('/sections/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as cnt FROM members WHERE section_id = ?',
      [req.params.id]
    );
    if ((rows[0] as any).cnt > 0) {
      res.status(400).json({ error: 'この課に所属するメンバーが存在します。先にメンバーの所属を変更してください。' });
      return;
    }
    await pool.query('DELETE FROM sections WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 2: コミット**

```bash
git add backend/src/routes/departments.ts
git commit -m "feat: add departments route (CRUD for departments and sections)"
```

---

## Task 4: index.ts に departments ルートを登録

**Files:**
- Modify: `backend/src/index.ts`

- [ ] **Step 1: departments ルートをインポートして登録**

`backend/src/index.ts` を以下に変更:

```typescript
import express from 'express';
import cors from 'cors';
import { waitForDb } from './db';
import { errorHandler } from './middleware/errorHandler';
import configRouter      from './routes/config';
import membersRouter     from './routes/members';
import workHoursRouter   from './routes/workHours';
import reportsRouter     from './routes/reports';
import importRouter      from './routes/import';
import departmentsRouter from './routes/departments';

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/v1/config',      configRouter);
app.use('/api/v1/members',     membersRouter);
app.use('/api/v1/work-hours',  workHoursRouter);
app.use('/api/v1/reports',     reportsRouter);
app.use('/api/v1/import',      importRouter);
app.use('/api/v1/departments', departmentsRouter);

app.use(errorHandler);

async function main() {
  await waitForDb();
  app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
}

main().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: ビルド確認**

```bash
cd backend && npm run build
```

期待: エラーなし

- [ ] **Step 3: 動作確認**

```bash
# バックエンド再起動後
curl http://localhost:3000/api/v1/departments
```

期待: `[]`（空配列）

- [ ] **Step 4: コミット**

```bash
git add backend/src/index.ts
git commit -m "feat: register departments router in backend"
```

---

## Task 5: members ルート更新（section_id 対応）

**Files:**
- Modify: `backend/src/routes/members.ts`

- [ ] **Step 1: members.ts を section_id 対応に更新**

```typescript
import { Router } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../db';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const activeOnly = req.query.active === '1';
    const where = activeOnly ? 'WHERE m.active = 1' : '';
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT m.id, m.code, m.name, m.unit_cost, m.section_id, m.active, m.created_at, m.updated_at,
              s.name AS section_name, s.department_id,
              d.name AS department_name
       FROM members m
       LEFT JOIN sections s ON s.id = m.section_id
       LEFT JOIN departments d ON d.id = s.department_id
       ${where}
       ORDER BY m.name`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { code, name, unit_cost, section_id } = req.body as {
      code: string;
      name: string;
      unit_cost?: number;
      section_id?: number | null;
    };
    if (!code || !name) {
      res.status(400).json({ error: 'code と name は必須です' });
      return;
    }
    const [result] = await pool.query(
      'INSERT INTO members (code, name, unit_cost, section_id) VALUES (?, ?, ?, ?)',
      [code, name, unit_cost ?? 0, section_id ?? null]
    );
    const id = (result as any).insertId;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT m.*, s.name AS section_name, s.department_id, d.name AS department_name
       FROM members m
       LEFT JOIN sections s ON s.id = m.section_id
       LEFT JOIN departments d ON d.id = s.department_id
       WHERE m.id = ?`,
      [id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { code, name, unit_cost, active } = req.body as {
      code?: string;
      name?: string;
      unit_cost?: number;
      active?: boolean;
    };
    // section_id は明示的に null を許容するため 'in' で存在確認
    const hasSectionId = 'section_id' in req.body;
    const section_id: number | null | undefined = hasSectionId
      ? (req.body.section_id ?? null)
      : undefined;

    if (hasSectionId) {
      await pool.query(
        `UPDATE members SET
          code      = COALESCE(?, code),
          name      = COALESCE(?, name),
          unit_cost = COALESCE(?, unit_cost),
          active    = COALESCE(?, active),
          section_id = ?
         WHERE id = ?`,
        [code ?? null, name ?? null, unit_cost ?? null,
         active != null ? (active ? 1 : 0) : null, section_id, req.params.id]
      );
    } else {
      await pool.query(
        `UPDATE members SET
          code      = COALESCE(?, code),
          name      = COALESCE(?, name),
          unit_cost = COALESCE(?, unit_cost),
          active    = COALESCE(?, active)
         WHERE id = ?`,
        [code ?? null, name ?? null, unit_cost ?? null,
         active != null ? (active ? 1 : 0) : null, req.params.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('UPDATE members SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 2: ビルド確認**

```bash
cd backend && npm run build
```

- [ ] **Step 3: 動作確認**

```bash
curl http://localhost:3000/api/v1/members
```

期待: メンバー一覧に `section_id`, `section_name`, `department_id`, `department_name` が含まれる（初期値は null）

- [ ] **Step 4: コミット**

```bash
git add backend/src/routes/members.ts
git commit -m "feat: add section_id support to members route (GET/POST/PUT)"
```

---

## Task 6: reports ルート更新（部・課情報 + department_summary）

**Files:**
- Modify: `backend/src/routes/reports.ts`

- [ ] **Step 1: GET /reports/monthly を更新**

`backend/src/routes/reports.ts` の月次レポート部分を以下に変更:

```typescript
import { Router } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../db';
import type { DepartmentSummary, SectionSummary } from '../types';

const router = Router();

async function getConfigValue(key: string, defaultVal: string): Promise<string> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT config_value FROM config WHERE config_key = ?',
    [key]
  );
  return (rows[0] as any)?.config_value ?? defaultVal;
}

// GET /api/v1/reports/monthly?year=2026&month=3
router.get('/monthly', async (req, res, next) => {
  try {
    const year  = parseInt(req.query.year  as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

    const deadlineDay = parseInt(await getConfigValue('planned_hours_deadline_day', '10'));
    const today = new Date();
    const isPastDeadline =
      today.getFullYear() > year ||
      (today.getFullYear() === year && today.getMonth() + 1 > month) ||
      (today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() >= deadlineDay);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT m.id, m.code, m.name, m.unit_cost, m.section_id,
              s.name AS section_name, s.department_id,
              d.name AS department_name,
              wh.planned_hours, wh.actual_hours, wh.note
       FROM members m
       LEFT JOIN sections s ON s.id = m.section_id
       LEFT JOIN departments d ON d.id = s.department_id
       LEFT JOIN work_hours wh ON wh.member_id = m.id AND wh.year = ? AND wh.month = ?
       WHERE m.active = 1
       ORDER BY m.name`,
      [year, month]
    );

    const members = rows.map(row => {
      const planned  = row.planned_hours !== null ? Number(row.planned_hours) : null;
      const actual   = row.actual_hours  !== null ? Number(row.actual_hours)  : null;
      const unitCost = Number(row.unit_cost);
      return {
        id:              row.id,
        code:            row.code,
        name:            row.name,
        unit_cost:       unitCost,
        section_id:      row.section_id ?? null,
        section_name:    row.section_name ?? null,
        department_id:   row.department_id ?? null,
        department_name: row.department_name ?? null,
        planned_hours:   planned,
        actual_hours:    actual,
        note:            row.note ?? null,
        missingPlanned:  isPastDeadline && planned === null,
        planned_cost:    planned !== null ? planned * unitCost : null,
        actual_cost:     actual  !== null ? actual  * unitCost : null,
      };
    });

    // 部・課別集計を members から算出
    const deptMap = new Map<number, {
      department_id: number;
      department_name: string;
      member_count: number;
      total_planned_hours: number;
      total_actual_hours: number;
      total_planned_cost: number;
      total_actual_cost: number;
      sectionMap: Map<number, SectionSummary>;
    }>();

    for (const m of members) {
      if (!m.department_id) continue;
      if (!deptMap.has(m.department_id)) {
        deptMap.set(m.department_id, {
          department_id:       m.department_id,
          department_name:     m.department_name!,
          member_count:        0,
          total_planned_hours: 0,
          total_actual_hours:  0,
          total_planned_cost:  0,
          total_actual_cost:   0,
          sectionMap:          new Map(),
        });
      }
      const dept = deptMap.get(m.department_id)!;
      dept.member_count        += 1;
      dept.total_planned_hours += m.planned_hours ?? 0;
      dept.total_actual_hours  += m.actual_hours  ?? 0;
      dept.total_planned_cost  += m.planned_cost  ?? 0;
      dept.total_actual_cost   += m.actual_cost   ?? 0;

      if (m.section_id) {
        if (!dept.sectionMap.has(m.section_id)) {
          dept.sectionMap.set(m.section_id, {
            section_id:          m.section_id,
            section_name:        m.section_name!,
            member_count:        0,
            total_planned_hours: 0,
            total_actual_hours:  0,
            total_planned_cost:  0,
            total_actual_cost:   0,
          });
        }
        const sec = dept.sectionMap.get(m.section_id)!;
        sec.member_count        += 1;
        sec.total_planned_hours += m.planned_hours ?? 0;
        sec.total_actual_hours  += m.actual_hours  ?? 0;
        sec.total_planned_cost  += m.planned_cost  ?? 0;
        sec.total_actual_cost   += m.actual_cost   ?? 0;
      }
    }

    const department_summary: DepartmentSummary[] = Array.from(deptMap.values()).map(d => ({
      department_id:       d.department_id,
      department_name:     d.department_name,
      member_count:        d.member_count,
      total_planned_hours: d.total_planned_hours,
      total_actual_hours:  d.total_actual_hours,
      total_planned_cost:  d.total_planned_cost,
      total_actual_cost:   d.total_actual_cost,
      sections:            Array.from(d.sectionMap.values()),
    }));

    res.json({ year, month, deadline_day: deadlineDay, is_past_deadline: isPastDeadline, members, department_summary });
  } catch (err) {
    next(err);
  }
});
```

年次レポートは既存コード（`router.get('/annual', ...)` 以降）をそのまま維持する。

- [ ] **Step 2: ビルド確認**

```bash
cd backend && npm run build
```

- [ ] **Step 3: 動作確認**

```bash
curl "http://localhost:3000/api/v1/reports/monthly?year=2026&month=4"
```

期待: レスポンスに `department_summary: []`（まだ部・課未設定のため空）と、各 member に `section_id: null, section_name: null, department_id: null, department_name: null` が含まれる

- [ ] **Step 4: コミット**

```bash
git add backend/src/routes/reports.ts
git commit -m "feat: add section/department info and department_summary to monthly report"
```

---

## Task 7: フロントエンド型定義更新

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: 型定義を更新**

`frontend/src/types/index.ts` を以下に置き換え:

```typescript
export interface Member {
  id: number;
  code: string;
  name: string;
  unit_cost: number;
  section_id: number | null;
  section_name: string | null;
  department_id: number | null;
  department_name: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: number;
  name: string;
  sections: Section[];
}

export interface Section {
  id: number;
  department_id: number;
  name: string;
}

export interface MonthlyMemberRow {
  id: number;
  code: string;
  name: string;
  unit_cost: number;
  section_id: number | null;
  section_name: string | null;
  department_id: number | null;
  department_name: string | null;
  planned_hours: number | null;
  actual_hours: number | null;
  note: string | null;
  missingPlanned: boolean;
  planned_cost: number | null;
  actual_cost: number | null;
}

export interface SectionSummary {
  section_id: number;
  section_name: string;
  member_count: number;
  total_planned_hours: number;
  total_actual_hours: number;
  total_planned_cost: number;
  total_actual_cost: number;
}

export interface DepartmentSummary {
  department_id: number;
  department_name: string;
  member_count: number;
  total_planned_hours: number;
  total_actual_hours: number;
  total_planned_cost: number;
  total_actual_cost: number;
  sections: SectionSummary[];
}

export interface MonthlyReport {
  year: number;
  month: number;
  deadline_day: number;
  is_past_deadline: boolean;
  members: MonthlyMemberRow[];
  department_summary: DepartmentSummary[];
}

export interface AnnualMonthData {
  year: number;
  month: number;
  label: string;
  planned_hours: number | null;
  actual_hours: number | null;
  planned_cost: number | null;
  actual_cost: number | null;
}

export interface AnnualMemberRow {
  member_id: number;
  member_code: string;
  member_name: string;
  unit_cost: number;
  months: AnnualMonthData[];
  total_planned_hours: number;
  total_actual_hours: number;
  total_planned_cost: number;
  total_actual_cost: number;
}

export interface AnnualReport {
  fiscal_year: number;
  fy_start_month: number;
  month_labels: string[];
  members: AnnualMemberRow[];
}

export interface ConfigEntry {
  value: string;
  description: string | null;
}

export type ConfigMap = Record<string, ConfigEntry>;

export interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
}
```

- [ ] **Step 2: コミット**

```bash
git add frontend/src/types/index.ts
git commit -m "feat: add Department, Section, DepartmentSummary types to frontend"
```

---

## Task 8: フロントエンド API クライアント更新

**Files:**
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: departments/sections API を追加**

`frontend/src/api/client.ts` を以下に置き換え:

```typescript
import type {
  Member, MonthlyReport, AnnualReport, ConfigMap, ImportResult,
  Department,
} from '../types';

const BASE = '/api/v1';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function json(method: string, body: unknown, extra?: RequestInit): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...extra,
  };
}

export const api = {
  /* ---------- Reports ---------- */
  getMonthlyReport: (year: number, month: number) =>
    req<MonthlyReport>(`/reports/monthly?year=${year}&month=${month}`),

  getAnnualReport: (fiscalYear: number) =>
    req<AnnualReport>(`/reports/annual?fiscal_year=${fiscalYear}`),

  /* ---------- Members ---------- */
  getMembers: (activeOnly = false) =>
    req<Member[]>(`/members${activeOnly ? '?active=1' : ''}`),

  createMember: (data: Pick<Member, 'code' | 'name' | 'unit_cost'> & { section_id?: number | null }) =>
    req<Member>('/members', json('POST', data)),

  updateMember: (id: number, data: Partial<Pick<Member, 'code' | 'name' | 'unit_cost' | 'active'>> & { section_id?: number | null }) =>
    req<{ success: boolean }>(`/members/${id}`, json('PUT', data)),

  deleteMember: (id: number) =>
    req<{ success: boolean }>(`/members/${id}`, { method: 'DELETE' }),

  /* ---------- Config ---------- */
  getConfig: () => req<ConfigMap>('/config'),

  updateConfig: (key: string, value: string) =>
    req<{ success: boolean }>(`/config/${encodeURIComponent(key)}`, json('PUT', { value })),

  /* ---------- Import ---------- */
  importCsv: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return req<ImportResult>('/import/csv', { method: 'POST', body: form });
  },

  /* ---------- Departments ---------- */
  getDepartments: () => req<Department[]>('/departments'),

  createDepartment: (name: string) =>
    req<Department>('/departments', json('POST', { name })),

  updateDepartment: (id: number, name: string) =>
    req<{ success: boolean }>(`/departments/${id}`, json('PUT', { name })),

  deleteDepartment: (id: number) =>
    req<{ success: boolean }>(`/departments/${id}`, { method: 'DELETE' }),

  /* ---------- Sections ---------- */
  createSection: (department_id: number, name: string) =>
    req<{ id: number; department_id: number; name: string }>(
      '/departments/sections', json('POST', { department_id, name })
    ),

  updateSection: (id: number, name: string) =>
    req<{ success: boolean }>(`/departments/sections/${id}`, json('PUT', { name })),

  deleteSection: (id: number) =>
    req<{ success: boolean }>(`/departments/sections/${id}`, { method: 'DELETE' }),
};
```

- [ ] **Step 2: フロントエンドのビルド確認**

```bash
cd frontend && npm run build
```

エラーなし

- [ ] **Step 3: コミット**

```bash
git add frontend/src/api/client.ts
git commit -m "feat: add departments/sections API calls to frontend client"
```

---

## Task 9: DepartmentsTab コンポーネント作成

**Files:**
- Create: `frontend/src/components/DepartmentsTab.tsx`

- [ ] **Step 1: DepartmentsTab.tsx を作成**

```typescript
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Department } from '../types';

export default function DepartmentsTab() {
  const qc = useQueryClient();
  const { data: departments = [], isLoading, error } = useQuery({
    queryKey: ['departments'],
    queryFn: api.getDepartments,
  });

  const [editDeptId,      setEditDeptId]      = useState<number | null>(null);
  const [editDeptName,    setEditDeptName]    = useState('');
  const [editSectionId,   setEditSectionId]   = useState<number | null>(null);
  const [editSectionName, setEditSectionName] = useState('');
  const [addingDept,            setAddingDept]            = useState(false);
  const [newDeptName,           setNewDeptName]           = useState('');
  const [addingSectionForDept,  setAddingSectionForDept]  = useState<number | null>(null);
  const [newSectionName,        setNewSectionName]        = useState('');
  const [errorMsg,              setErrorMsg]              = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['departments'] });

  const createDeptMut = useMutation({
    mutationFn: (name: string) => api.createDepartment(name),
    onSuccess: () => { invalidate(); setNewDeptName(''); setAddingDept(false); },
  });

  const updateDeptMut = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => api.updateDepartment(id, name),
    onSuccess: () => { invalidate(); setEditDeptId(null); },
  });

  const deleteDeptMut = useMutation({
    mutationFn: (id: number) => api.deleteDepartment(id),
    onSuccess: () => invalidate(),
    onError: (e: Error) => setErrorMsg(e.message),
  });

  const createSecMut = useMutation({
    mutationFn: ({ deptId, name }: { deptId: number; name: string }) =>
      api.createSection(deptId, name),
    onSuccess: () => { invalidate(); setNewSectionName(''); setAddingSectionForDept(null); },
  });

  const updateSecMut = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => api.updateSection(id, name),
    onSuccess: () => { invalidate(); setEditSectionId(null); },
  });

  const deleteSecMut = useMutation({
    mutationFn: (id: number) => api.deleteSection(id),
    onSuccess: () => invalidate(),
    onError: (e: Error) => setErrorMsg(e.message),
  });

  if (isLoading) return <p className="p-4 text-gray-500">読み込み中...</p>;
  if (error)     return <p className="p-4 text-red-600">エラー: {String(error)}</p>;

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-2 text-red-700 text-sm flex justify-between">
          <span>{errorMsg}</span>
          <button className="ml-4 text-red-400 hover:text-red-600" onClick={() => setErrorMsg(null)}>✕</button>
        </div>
      )}

      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setAddingDept(true)}>+ 部を追加</button>
      </div>

      {addingDept && (
        <div className="card flex items-center gap-2">
          <input
            className="input flex-1"
            placeholder="部の名称"
            value={newDeptName}
            autoFocus
            onChange={e => setNewDeptName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newDeptName) createDeptMut.mutate(newDeptName);
              if (e.key === 'Escape') { setAddingDept(false); setNewDeptName(''); }
            }}
          />
          <button className="btn-primary text-xs py-1 px-3"
            disabled={!newDeptName} onClick={() => createDeptMut.mutate(newDeptName)}>登録</button>
          <button className="btn-secondary text-xs py-1 px-3"
            onClick={() => { setAddingDept(false); setNewDeptName(''); }}>戻る</button>
        </div>
      )}

      {departments.map((dept: Department) => (
        <div key={dept.id} className="card space-y-3">
          {/* 部ヘッダー */}
          <div className="flex items-center gap-2">
            {editDeptId === dept.id ? (
              <>
                <input
                  className="input flex-1"
                  value={editDeptName}
                  autoFocus
                  onChange={e => setEditDeptName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') updateDeptMut.mutate({ id: dept.id, name: editDeptName });
                    if (e.key === 'Escape') setEditDeptId(null);
                  }}
                />
                <button className="btn-primary text-xs py-1 px-3"
                  onClick={() => updateDeptMut.mutate({ id: dept.id, name: editDeptName })}>保存</button>
                <button className="btn-secondary text-xs py-1 px-3"
                  onClick={() => setEditDeptId(null)}>戻る</button>
              </>
            ) : (
              <>
                <span className="font-semibold text-gray-800 flex-1">▼ {dept.name}</span>
                <button className="btn-secondary text-xs py-1 px-2"
                  onClick={() => { setEditDeptId(dept.id); setEditDeptName(dept.name); }}>編集</button>
                <button className="btn-danger text-xs py-1 px-2"
                  onClick={() => {
                    if (confirm(`「${dept.name}」を削除しますか？`)) {
                      setErrorMsg(null);
                      deleteDeptMut.mutate(dept.id);
                    }
                  }}>削除</button>
              </>
            )}
          </div>

          {/* 課一覧 */}
          <div className="ml-4 space-y-2">
            {dept.sections.map(sec => (
              <div key={sec.id} className="flex items-center gap-2">
                {editSectionId === sec.id ? (
                  <>
                    <span className="text-gray-400 text-sm w-3">└</span>
                    <input
                      className="input flex-1"
                      value={editSectionName}
                      autoFocus
                      onChange={e => setEditSectionName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') updateSecMut.mutate({ id: sec.id, name: editSectionName });
                        if (e.key === 'Escape') setEditSectionId(null);
                      }}
                    />
                    <button className="btn-primary text-xs py-1 px-3"
                      onClick={() => updateSecMut.mutate({ id: sec.id, name: editSectionName })}>保存</button>
                    <button className="btn-secondary text-xs py-1 px-3"
                      onClick={() => setEditSectionId(null)}>戻る</button>
                  </>
                ) : (
                  <>
                    <span className="text-gray-400 text-sm w-3">└</span>
                    <span className="flex-1 text-gray-700">{sec.name}</span>
                    <button className="btn-secondary text-xs py-1 px-2"
                      onClick={() => { setEditSectionId(sec.id); setEditSectionName(sec.name); }}>編集</button>
                    <button className="btn-danger text-xs py-1 px-2"
                      onClick={() => {
                        if (confirm(`「${sec.name}」を削除しますか？`)) {
                          setErrorMsg(null);
                          deleteSecMut.mutate(sec.id);
                        }
                      }}>削除</button>
                  </>
                )}
              </div>
            ))}

            {/* 課追加フォーム */}
            {addingSectionForDept === dept.id ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm w-3">└</span>
                <input
                  className="input flex-1"
                  placeholder="課の名称"
                  value={newSectionName}
                  autoFocus
                  onChange={e => setNewSectionName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newSectionName)
                      createSecMut.mutate({ deptId: dept.id, name: newSectionName });
                    if (e.key === 'Escape') { setAddingSectionForDept(null); setNewSectionName(''); }
                  }}
                />
                <button className="btn-primary text-xs py-1 px-3"
                  disabled={!newSectionName}
                  onClick={() => createSecMut.mutate({ deptId: dept.id, name: newSectionName })}>登録</button>
                <button className="btn-secondary text-xs py-1 px-3"
                  onClick={() => { setAddingSectionForDept(null); setNewSectionName(''); }}>戻る</button>
              </div>
            ) : (
              <button
                className="text-blue-500 text-xs hover:underline ml-4"
                onClick={() => { setAddingSectionForDept(dept.id); setNewSectionName(''); }}
              >
                + 課を追加
              </button>
            )}
          </div>
        </div>
      ))}

      {departments.length === 0 && !addingDept && (
        <p className="text-gray-400 text-sm text-center py-4">部が登録されていません。</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add frontend/src/components/DepartmentsTab.tsx
git commit -m "feat: add DepartmentsTab component for department/section management"
```

---

## Task 10: ConfigPage にタブを追加

**Files:**
- Modify: `frontend/src/pages/ConfigPage.tsx`

- [ ] **Step 1: ConfigPage.tsx を更新（タブ追加）**

```typescript
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import DepartmentsTab from '../components/DepartmentsTab';

type Tab = 'config' | 'departments';

const LABELS: Record<string, string> = {
  planned_hours_deadline_day: '予定工数締日（日）',
  fiscal_year_start_month:   '年度開始月（1=1月, 4=4月）',
  currency:                  '通貨',
  company_name:              'システム名称',
};

function SystemConfigTab() {
  const qc = useQueryClient();
  const [editKey,   setEditKey]   = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saved,     setSaved]     = useState<string | null>(null);

  const { data: config, isLoading, error } = useQuery({
    queryKey: ['config'],
    queryFn:  api.getConfig,
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      api.updateConfig(key, value),
    onSuccess: (_, { key }) => {
      qc.invalidateQueries({ queryKey: ['config'] });
      setEditKey(null);
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    },
  });

  if (isLoading) return <p className="p-4 text-gray-500">読み込み中...</p>;
  if (error)     return <p className="p-4 text-red-600">エラー: {String(error)}</p>;
  if (!config)   return null;

  return (
    <div className="space-y-4">
      <div className="card p-0 overflow-hidden">
        <table className="table-base">
          <thead>
            <tr>
              <th>設定項目</th>
              <th>値</th>
              <th>説明</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(config).map(([key, entry]) => (
              <tr key={key}>
                <td className="font-medium">{LABELS[key] ?? key}</td>
                <td>
                  {editKey === key ? (
                    <input
                      className="input w-36"
                      value={editValue}
                      autoFocus
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') updateMutation.mutate({ key, value: editValue });
                        if (e.key === 'Escape') setEditKey(null);
                      }}
                    />
                  ) : (
                    <span className="font-mono">{entry.value}</span>
                  )}
                </td>
                <td className="text-gray-500 text-xs">{entry.description}</td>
                <td>
                  {editKey === key ? (
                    <div className="flex gap-1.5">
                      <button
                        className="btn-primary text-xs py-1 px-2"
                        disabled={updateMutation.isPending}
                        onClick={() => updateMutation.mutate({ key, value: editValue })}
                      >保存</button>
                      <button className="btn-secondary text-xs py-1 px-2" onClick={() => setEditKey(null)}>
                        戻る
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn-secondary text-xs py-1 px-2"
                      onClick={() => { setEditKey(key); setEditValue(entry.value); }}
                    >編集</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-300 rounded-lg px-4 py-2 text-green-700 text-sm">
          「{LABELS[saved] ?? saved}」を保存しました。
        </div>
      )}
      {updateMutation.isError && (
        <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-2 text-red-700 text-sm">
          エラー: {String(updateMutation.error)}
        </div>
      )}
      <div className="card bg-blue-50 border-blue-200 text-sm text-blue-800 space-y-1">
        <p className="font-semibold">設定値の説明</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li><strong>予定工数締日：</strong>毎月この日以降に予定工数が未登録のメンバーを赤字表示します。</li>
          <li><strong>年度開始月：</strong>年次レポートの集計期間の開始月（例: 4 = 4月〜翌3月）。</li>
        </ul>
      </div>
    </div>
  );
}

export default function ConfigPage() {
  const [tab, setTab] = useState<Tab>('config');

  return (
    <div className="space-y-5 max-w-2xl">
      <h2 className="text-xl font-bold text-gray-800">システム設定</h2>

      <div className="flex gap-1 border-b border-gray-200">
        {([['config', 'システム設定'], ['departments', '部・課管理']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setTab(t)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'config' ? <SystemConfigTab /> : <DepartmentsTab />}
    </div>
  );
}
```

- [ ] **Step 2: 動作確認**

ブラウザで `/config` を開き、「システム設定」「部・課管理」タブが切り替わること、部の追加・編集・削除、課の追加・編集・削除が動作することを確認。

- [ ] **Step 3: コミット**

```bash
git add frontend/src/pages/ConfigPage.tsx
git commit -m "feat: add department/section management tab to ConfigPage"
```

---

## Task 11: MembersPage 更新（部・課列 / フォーム / 集計テーブル）

**Files:**
- Modify: `frontend/src/pages/MembersPage.tsx`

- [ ] **Step 1: MembersPage.tsx を更新**

```typescript
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Member, Department, DepartmentSummary } from '../types';

interface FormState {
  code: string;
  name: string;
  unit_cost: string;
  section_id: number | null;
}

const EMPTY: FormState = { code: '', name: '', unit_cost: '', section_id: null };

function fmt(n: number, digits = 1) {
  return n.toLocaleString('ja-JP', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function SectionSelect({
  departments,
  value,
  onChange,
}: {
  departments: Department[];
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  // 選択中の section_id からどの部に属するかを特定（セレクトボックスの表示用）
  return (
    <select
      className="select w-full"
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
    >
      <option value="">（未所属）</option>
      {departments.map(dept => (
        <optgroup key={dept.id} label={dept.name}>
          {dept.sections.map(sec => (
            <option key={sec.id} value={sec.id}>{sec.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function DeptSummaryTable({ summary }: { summary: DepartmentSummary[] }) {
  if (summary.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-4">部・課が設定されていないか、データがありません。</p>;
  }
  return (
    <div className="card p-0 overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th>部</th>
            <th>課</th>
            <th className="text-right">メンバー数</th>
            <th className="text-right">予定工数(h)</th>
            <th className="text-right">実績工数(h)</th>
            <th className="text-right">予定コスト(円)</th>
            <th className="text-right">実績コスト(円)</th>
          </tr>
        </thead>
        <tbody>
          {summary.map(dept => (
            <>
              <tr key={dept.department_id} className="bg-gray-50 font-medium">
                <td>{dept.department_name}</td>
                <td className="text-gray-500 text-xs">合計</td>
                <td className="text-right">{dept.member_count}</td>
                <td className="text-right">{fmt(dept.total_planned_hours)}</td>
                <td className="text-right">{fmt(dept.total_actual_hours)}</td>
                <td className="text-right">{dept.total_planned_cost.toLocaleString()}</td>
                <td className="text-right">{dept.total_actual_cost.toLocaleString()}</td>
              </tr>
              {dept.sections.map(sec => (
                <tr key={sec.section_id}>
                  <td></td>
                  <td className="pl-4 text-gray-700">{sec.section_name}</td>
                  <td className="text-right">{sec.member_count}</td>
                  <td className="text-right">{fmt(sec.total_planned_hours)}</td>
                  <td className="text-right">{fmt(sec.total_actual_hours)}</td>
                  <td className="text-right">{sec.total_planned_cost.toLocaleString()}</td>
                  <td className="text-right">{sec.total_actual_cost.toLocaleString()}</td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MembersPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [showAll,    setShowAll]    = useState(false);
  const [editId,     setEditId]     = useState<number | null>(null);
  const [editForm,   setEditForm]   = useState<FormState>(EMPTY);
  const [newForm,    setNewForm]    = useState<FormState>(EMPTY);
  const [showAdd,    setShowAdd]    = useState(false);
  const [fiscalYear, setFiscalYear] = useState(now.getFullYear());
  const [deptYear,   setDeptYear]   = useState(now.getFullYear());
  const [deptMonth,  setDeptMonth]  = useState(now.getMonth() + 1);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', showAll],
    queryFn: () => api.getMembers(!showAll),
  });

  const { data: annualData } = useQuery({
    queryKey: ['annual-report', fiscalYear],
    queryFn: () => api.getAnnualReport(fiscalYear),
  });

  const { data: deptMonthlyData } = useQuery({
    queryKey: ['monthly-report', deptYear, deptMonth],
    queryFn: () => api.getMonthlyReport(deptYear, deptMonth),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: api.getDepartments,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['members'] });
    qc.invalidateQueries({ queryKey: ['annual-report'] });
  };

  const createMutation = useMutation({
    mutationFn: () => api.createMember({
      code:      newForm.code,
      name:      newForm.name,
      unit_cost: Number(newForm.unit_cost),
      section_id: newForm.section_id,
    }),
    onSuccess: () => { invalidate(); setNewForm(EMPTY); setShowAdd(false); },
  });

  const updateMutation = useMutation({
    mutationFn: (id: number) => api.updateMember(id, {
      code:       editForm.code,
      name:       editForm.name,
      unit_cost:  Number(editForm.unit_cost),
      section_id: editForm.section_id,
    }),
    onSuccess: () => { invalidate(); setEditId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteMember(id),
    onSuccess: () => invalidate(),
  });

  const costMap = new Map<number, { planned: number; actual: number }>(
    (annualData?.members ?? []).map(m => [
      m.member_id,
      { planned: m.total_planned_cost, actual: m.total_actual_cost },
    ])
  );

  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">メンバー管理</h2>
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
            退職者も表示
          </label>
          <button className="btn-primary" onClick={() => setShowAdd(!showAdd)}>+ メンバー追加</button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card space-y-3">
          <h3 className="font-semibold">新規メンバー</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">コード *</label>
              <input className="input w-full" value={newForm.code} placeholder="M001"
                onChange={e => setNewForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">氏名 *</label>
              <input className="input w-full" value={newForm.name} placeholder="田中太郎"
                onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">単価（円/時間）</label>
              <input className="input w-full" type="number" value={newForm.unit_cost} placeholder="5000"
                onChange={e => setNewForm(f => ({ ...f, unit_cost: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">課</label>
              <SectionSelect
                departments={departments}
                value={newForm.section_id}
                onChange={v => setNewForm(f => ({ ...f, section_id: v }))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={!newForm.code || !newForm.name}
              onClick={() => createMutation.mutate()}>登録</button>
            <button className="btn-secondary" onClick={() => { setShowAdd(false); setNewForm(EMPTY); }}>
              キャンセル
            </button>
          </div>
          {createMutation.isError && (
            <p className="text-red-600 text-sm">{String(createMutation.error)}</p>
          )}
        </div>
      )}

      {/* Members table */}
      <div className="card p-0 overflow-x-auto">
        {isLoading
          ? <p className="p-4 text-gray-500">読み込み中...</p>
          : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>コード</th><th>氏名</th>
                  <th>部</th><th>課</th>
                  <th className="text-right">単価（円/h）</th>
                  <th>在籍</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m: Member) => (
                  <tr key={m.id}>
                    {editId === m.id ? (
                      <>
                        <td><input className="input w-24" value={editForm.code}
                          onChange={e => setEditForm(f => ({ ...f, code: e.target.value }))} /></td>
                        <td><input className="input w-36" value={editForm.name}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></td>
                        <td colSpan={2}>
                          <SectionSelect
                            departments={departments}
                            value={editForm.section_id}
                            onChange={v => setEditForm(f => ({ ...f, section_id: v }))}
                          />
                        </td>
                        <td className="text-right">
                          <input className="input w-28 text-right" type="number" value={editForm.unit_cost}
                            onChange={e => setEditForm(f => ({ ...f, unit_cost: e.target.value }))} />
                        </td>
                        <td><span className={m.active ? 'text-green-600' : 'text-gray-400'}>{m.active ? '在籍' : '退職'}</span></td>
                        <td className="flex gap-1.5">
                          <button className="btn-primary text-xs py-1 px-2" onClick={() => updateMutation.mutate(m.id)}>保存</button>
                          <button className="btn-secondary text-xs py-1 px-2" onClick={() => setEditId(null)}>戻る</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="font-mono text-xs">{m.code}</td>
                        <td>{m.name}</td>
                        <td className="text-gray-600 text-sm">{m.department_name ?? '—'}</td>
                        <td className="text-gray-600 text-sm">{m.section_name ?? '—'}</td>
                        <td className="text-right">{m.unit_cost.toLocaleString()}</td>
                        <td><span className={m.active ? 'text-green-600' : 'text-gray-400'}>{m.active ? '在籍' : '退職'}</span></td>
                        <td className="flex gap-1.5">
                          <button className="btn-secondary text-xs py-1 px-2"
                            onClick={() => {
                              setEditId(m.id);
                              setEditForm({ code: m.code, name: m.name, unit_cost: String(m.unit_cost), section_id: m.section_id });
                            }}>編集</button>
                          {m.active && (
                            <button className="btn-danger text-xs py-1 px-2"
                              onClick={() => { if (confirm(`${m.name} を退職扱いにしますか？`)) deleteMutation.mutate(m.id); }}>
                              退職
                            </button>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>

      {/* Annual cost summary */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-700">年度別コストサマリー</h3>
          <select className="select" value={fiscalYear} onChange={e => setFiscalYear(Number(e.target.value))}>
            {yearOptions.map(y => <option key={y} value={y}>{y}年度</option>)}
          </select>
        </div>
        <div className="card p-0 overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>メンバー名</th>
                <th className="text-right">単価（円/h）</th>
                <th className="text-right">予定工数合計(h)</th>
                <th className="text-right">実績工数合計(h)</th>
                <th className="text-right">予定コスト(円)</th>
                <th className="text-right">実績コスト(円)</th>
              </tr>
            </thead>
            <tbody>
              {(annualData?.members ?? []).map(m => {
                const cost = costMap.get(m.member_id)!;
                return (
                  <tr key={m.member_id}>
                    <td>{m.member_name}</td>
                    <td className="text-right">{m.unit_cost.toLocaleString()}</td>
                    <td className="text-right">{m.total_planned_hours.toFixed(1)}</td>
                    <td className="text-right">{m.total_actual_hours.toFixed(1)}</td>
                    <td className="text-right">{cost.planned.toLocaleString()}</td>
                    <td className="text-right">{cost.actual.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>合計</td>
                <td className="text-right">
                  {(annualData?.members ?? []).reduce((s, m) => s + m.total_planned_hours, 0).toFixed(1)}
                </td>
                <td className="text-right">
                  {(annualData?.members ?? []).reduce((s, m) => s + m.total_actual_hours, 0).toFixed(1)}
                </td>
                <td className="text-right">
                  {(annualData?.members ?? []).reduce((s, m) => s + m.total_planned_cost, 0).toLocaleString()}
                </td>
                <td className="text-right">
                  {(annualData?.members ?? []).reduce((s, m) => s + m.total_actual_cost, 0).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Dept/Section summary */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-700">部・課別集計</h3>
          <select className="select" value={deptYear} onChange={e => setDeptYear(Number(e.target.value))}>
            {yearOptions.map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
          <select className="select" value={deptMonth} onChange={e => setDeptMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
        </div>
        <DeptSummaryTable summary={deptMonthlyData?.department_summary ?? []} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 動作確認**

`/members` を開き、以下を確認:
- メンバー一覧に「部」「課」列が表示される
- 編集フォームに課セレクトボックスが表示される
- 部・課別集計テーブルが表示される（部・課未設定なら「データなし」メッセージ）

- [ ] **Step 3: コミット**

```bash
git add frontend/src/pages/MembersPage.tsx
git commit -m "feat: add dept/section columns, form select, and dept summary table to MembersPage"
```

---

## Task 12: ReportPage に部・課別タブを追加

**Files:**
- Modify: `frontend/src/pages/ReportPage.tsx`

- [ ] **Step 1: ReportPage.tsx を更新**

```typescript
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { MonthlyMemberRow, AnnualMemberRow, DepartmentSummary } from '../types';

type Tab = 'monthly' | 'annual' | 'dept';

function fmt(n: number | null, digits = 1) {
  if (n === null) return '—';
  return n.toLocaleString('ja-JP', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtCost(n: number | null) {
  if (n === null) return '—';
  return n.toLocaleString('ja-JP');
}

/* ── Monthly tab ── */
function MonthlyTab({ year, month }: { year: number; month: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['monthly-report', year, month],
    queryFn: () => api.getMonthlyReport(year, month),
  });
  const members = data?.members ?? [];
  const totalP  = members.reduce((s, m) => s + (m.planned_hours ?? 0), 0);
  const totalA  = members.reduce((s, m) => s + (m.actual_hours  ?? 0), 0);
  const totalPC = members.reduce((s, m) => s + (m.planned_cost  ?? 0), 0);
  const totalAC = members.reduce((s, m) => s + (m.actual_cost   ?? 0), 0);

  if (isLoading) return <p className="p-4 text-gray-500">読み込み中...</p>;
  if (error)     return <p className="p-4 text-red-600">エラー: {String(error)}</p>;

  return (
    <div className="overflow-x-auto">
      {data?.is_past_deadline && members.some(m => m.missingPlanned) && (
        <div className="m-4 bg-red-50 border border-red-300 rounded-lg px-4 py-2 text-red-700 text-sm">
          締日（{data.deadline_day}日）超過 — 予定工数未登録：
          {members.filter(m => m.missingPlanned).map(m => m.name).join('、')}
        </div>
      )}
      <table className="table-base">
        <thead>
          <tr>
            <th>コード</th><th>メンバー名</th>
            <th className="text-right">予定工数(h)</th>
            <th className="text-right">実績工数(h)</th>
            <th className="text-right">差異(h)</th>
            <th className="text-right">予定コスト(円)</th>
            <th className="text-right">実績コスト(円)</th>
          </tr>
        </thead>
        <tbody>
          {members.map(row => (
            <MonthlyRow key={row.id} row={row} pastDeadline={data?.is_past_deadline ?? false} />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>合計</td>
            <td className="text-right">{fmt(totalP)}</td>
            <td className="text-right">{fmt(totalA)}</td>
            <td className="text-right">{fmt(totalA - totalP)}</td>
            <td className="text-right">{fmtCost(totalPC)}</td>
            <td className="text-right">{fmtCost(totalAC)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function MonthlyRow({ row, pastDeadline }: { row: MonthlyMemberRow; pastDeadline: boolean }) {
  const alert = pastDeadline && row.missingPlanned;
  const diff  = (row.actual_hours ?? 0) - (row.planned_hours ?? 0);
  return (
    <tr className={alert ? 'row-alert' : ''}>
      <td>{row.code}</td>
      <td>{row.name}{alert && <span className="ml-1 text-xs text-red-500">（未登録）</span>}</td>
      <td className="text-right">{alert ? <span className="badge-red">未登録</span> : fmt(row.planned_hours)}</td>
      <td className="text-right">{fmt(row.actual_hours)}</td>
      <td className="text-right">{row.planned_hours !== null ? fmt(diff) : '—'}</td>
      <td className="text-right">{fmtCost(row.planned_cost)}</td>
      <td className="text-right">{fmtCost(row.actual_cost)}</td>
    </tr>
  );
}

/* ── Annual tab ── */
function AnnualTab({ fiscalYear }: { fiscalYear: number }) {
  const [showCost, setShowCost] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['annual-report', fiscalYear],
    queryFn: () => api.getAnnualReport(fiscalYear),
  });

  if (isLoading) return <p className="p-4 text-gray-500">読み込み中...</p>;
  if (error)     return <p className="p-4 text-red-600">エラー: {String(error)}</p>;
  if (!data)     return null;

  const labels = data.month_labels;

  return (
    <div>
      <div className="p-4 flex gap-2">
        <button className={`btn ${!showCost ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowCost(false)}>工数表示</button>
        <button className={`btn ${showCost ? 'btn-primary' : 'btn-secondary'}`}  onClick={() => setShowCost(true)}>コスト表示</button>
      </div>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>メンバー名</th>
              {labels.map(l => <th key={l} className="text-center" colSpan={2}>{l}</th>)}
              <th className="text-right" colSpan={2}>合計</th>
            </tr>
            <tr>
              <th></th>
              {labels.map(l => (
                <>
                  <th key={l + 'p'} className="text-right text-xs text-gray-400">予定</th>
                  <th key={l + 'a'} className="text-right text-xs text-gray-400">実績</th>
                </>
              ))}
              <th className="text-right text-xs text-gray-400">予定</th>
              <th className="text-right text-xs text-gray-400">実績</th>
            </tr>
          </thead>
          <tbody>
            {data.members.map(member => <AnnualRow key={member.member_id} member={member} showCost={showCost} />)}
          </tbody>
          <tfoot>
            <AnnualFooter members={data.members} showCost={showCost} />
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function AnnualRow({ member, showCost }: { member: AnnualMemberRow; showCost: boolean }) {
  return (
    <tr>
      <td>{member.member_name}</td>
      {member.months.map(m => (
        <>
          <td key={m.label + 'p'} className="text-right">{showCost ? fmtCost(m.planned_cost) : fmt(m.planned_hours)}</td>
          <td key={m.label + 'a'} className="text-right">{showCost ? fmtCost(m.actual_cost)  : fmt(m.actual_hours)}</td>
        </>
      ))}
      <td className="text-right font-medium">{showCost ? fmtCost(member.total_planned_cost)  : fmt(member.total_planned_hours)}</td>
      <td className="text-right font-medium">{showCost ? fmtCost(member.total_actual_cost)   : fmt(member.total_actual_hours)}</td>
    </tr>
  );
}

function AnnualFooter({ members, showCost }: { members: AnnualMemberRow[]; showCost: boolean }) {
  if (!members.length) return null;
  const monthCount = members[0].months.length;
  const totalsP = members[0].months.map((_, mi) =>
    members.reduce((s, mem) => s + ((showCost ? mem.months[mi].planned_cost : mem.months[mi].planned_hours) ?? 0), 0)
  );
  const totalsA = members[0].months.map((_, mi) =>
    members.reduce((s, mem) => s + ((showCost ? mem.months[mi].actual_cost : mem.months[mi].actual_hours) ?? 0), 0)
  );
  const grandP = showCost ? members.reduce((s, m) => s + m.total_planned_cost, 0)  : members.reduce((s, m) => s + m.total_planned_hours, 0);
  const grandA = showCost ? members.reduce((s, m) => s + m.total_actual_cost, 0)   : members.reduce((s, m) => s + m.total_actual_hours, 0);

  return (
    <tr>
      <td>合計</td>
      {Array.from({ length: monthCount }, (_, i) => (
        <>
          <td key={i + 'p'} className="text-right">{showCost ? fmtCost(totalsP[i]) : fmt(totalsP[i])}</td>
          <td key={i + 'a'} className="text-right">{showCost ? fmtCost(totalsA[i]) : fmt(totalsA[i])}</td>
        </>
      ))}
      <td className="text-right">{showCost ? fmtCost(grandP) : fmt(grandP)}</td>
      <td className="text-right">{showCost ? fmtCost(grandA) : fmt(grandA)}</td>
    </tr>
  );
}

/* ── Dept/Section tab ── */
function DeptTab({ year, month }: { year: number; month: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['monthly-report', year, month],
    queryFn: () => api.getMonthlyReport(year, month),
  });

  if (isLoading) return <p className="p-4 text-gray-500">読み込み中...</p>;
  if (error)     return <p className="p-4 text-red-600">エラー: {String(error)}</p>;

  const summary: DepartmentSummary[] = data?.department_summary ?? [];

  if (summary.length === 0) {
    return <p className="p-4 text-gray-400">部・課が設定されていないか、データがありません。</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th>部</th>
            <th>課</th>
            <th className="text-right">メンバー数</th>
            <th className="text-right">予定工数(h)</th>
            <th className="text-right">実績工数(h)</th>
            <th className="text-right">予定コスト(円)</th>
            <th className="text-right">実績コスト(円)</th>
          </tr>
        </thead>
        <tbody>
          {summary.map(dept => (
            <>
              <tr key={dept.department_id} className="bg-gray-50 font-medium">
                <td>{dept.department_name}</td>
                <td className="text-gray-500 text-xs">合計</td>
                <td className="text-right">{dept.member_count}</td>
                <td className="text-right">{fmt(dept.total_planned_hours)}</td>
                <td className="text-right">{fmt(dept.total_actual_hours)}</td>
                <td className="text-right">{dept.total_planned_cost.toLocaleString()}</td>
                <td className="text-right">{dept.total_actual_cost.toLocaleString()}</td>
              </tr>
              {dept.sections.map(sec => (
                <tr key={sec.section_id}>
                  <td></td>
                  <td className="pl-4 text-gray-700">{sec.section_name}</td>
                  <td className="text-right">{sec.member_count}</td>
                  <td className="text-right">{fmt(sec.total_planned_hours)}</td>
                  <td className="text-right">{fmt(sec.total_actual_hours)}</td>
                  <td className="text-right">{sec.total_planned_cost.toLocaleString()}</td>
                  <td className="text-right">{sec.total_actual_cost.toLocaleString()}</td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Page ── */
export default function ReportPage() {
  const now = new Date();
  const [tab,        setTab]        = useState<Tab>('monthly');
  const [year,       setYear]       = useState(now.getFullYear());
  const [month,      setMonth]      = useState(now.getMonth() + 1);
  const [fiscalYear, setFiscalYear] = useState(now.getFullYear());
  const [deptYear,   setDeptYear]   = useState(now.getFullYear());
  const [deptMonth,  setDeptMonth]  = useState(now.getMonth() + 1);

  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">工数レポート</h2>

      <div className="flex gap-1 border-b border-gray-200">
        {([['monthly', '月次'], ['annual', '年次'], ['dept', '部・課別']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setTab(t)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {tab === 'monthly' && (
          <>
            <select className="select" value={year}  onChange={e => setYear(Number(e.target.value))}>
              {yearOptions.map(y => <option key={y} value={y}>{y}年</option>)}
            </select>
            <select className="select" value={month} onChange={e => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
          </>
        )}
        {tab === 'annual' && (
          <select className="select" value={fiscalYear} onChange={e => setFiscalYear(Number(e.target.value))}>
            {yearOptions.map(y => <option key={y} value={y}>{y}年度</option>)}
          </select>
        )}
        {tab === 'dept' && (
          <>
            <select className="select" value={deptYear}  onChange={e => setDeptYear(Number(e.target.value))}>
              {yearOptions.map(y => <option key={y} value={y}>{y}年</option>)}
            </select>
            <select className="select" value={deptMonth} onChange={e => setDeptMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
          </>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        {tab === 'monthly' && <MonthlyTab year={year} month={month} />}
        {tab === 'annual'  && <AnnualTab fiscalYear={fiscalYear} />}
        {tab === 'dept'    && <DeptTab year={deptYear} month={deptMonth} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 動作確認**

`/report` を開き、「月次」「年次」「部・課別」タブが切り替わること、部・課別タブで年月セレクタと集計テーブルが表示されることを確認。

- [ ] **Step 3: フロントエンドビルド最終確認**

```bash
cd frontend && npm run build
```

エラーなし

- [ ] **Step 4: コミット**

```bash
git add frontend/src/pages/ReportPage.tsx
git commit -m "feat: add dept/section tab to ReportPage"
```

---

## Self-Review チェックリスト

- [x] **スペックカバレッジ:** departments/sections CRUD ✓、members section_id ✓、monthly report department_summary ✓、ConfigPage タブ ✓、MembersPage 列/フォーム/集計 ✓、ReportPage タブ ✓
- [x] **型一貫性:** `Department`, `Section`, `DepartmentSummary`, `SectionSummary` は backend/frontend で同名・同構造
- [x] **API パス整合:** `/departments` (部CRUD)、`/departments/sections` (課CRUD) — departments.ts ルートと client.ts で一致
- [x] **null許容:** `section_id` は DB・型・フォーム全て `null` 許容で統一
- [x] **削除制約:** 課に所属メンバーあり / 部に所属課あり の場合 400 エラーをアプリ側で返す
