# CSV取込拡張（部・課マスタ／メンバー）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ImportPage に「部・課マスタ」「メンバー」CSV取込タブを追加し、UIから部・課・メンバーを一括登録できるようにする。

**Architecture:** バックエンドに2本の独立したルートファイル（importDepartments.ts / importMembers.ts）を追加しフロントエンドの ImportPage を3タブ化する。既存の工数取込には一切触れない。

**Tech Stack:** MySQL 8 / Express+TypeScript / multer / csv-parse / React+TypeScript / TanStack Query 5 / Tailwind CSS

---

## ファイル構成

| ファイル | 変更種別 | 責務 |
|---------|---------|------|
| `db/init/01_schema.sql` | 変更 | departments.name と sections.(department_id,name) に UNIQUE KEY 追加 |
| `backend/src/routes/importDepartments.ts` | 新規 | POST /api/v1/import/departments の全ロジック |
| `backend/src/routes/importMembers.ts` | 新規 | POST /api/v1/import/members の全ロジック |
| `backend/src/index.ts` | 変更 | 2つの新規ルートを登録 |
| `frontend/src/api/client.ts` | 変更 | importDepartmentsCsv / importMembersCsv を追加 |
| `frontend/src/pages/ImportPage.tsx` | 変更 | 3タブ化（工数 / 部・課マスタ / メンバー） |

---

## Task 1: DBスキーマに UNIQUE KEY を追加

**Files:**
- Modify: `db/init/01_schema.sql`

- [ ] **Step 1: departments テーブルに UNIQUE KEY を追加**

`db/init/01_schema.sql` の departments テーブル定義を以下に変更:

```sql
CREATE TABLE IF NOT EXISTS departments (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_department_name (name)
);
```

- [ ] **Step 2: sections テーブルに UNIQUE KEY を追加**

sections テーブル定義を以下に変更:

```sql
CREATE TABLE IF NOT EXISTS sections (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  department_id INT UNSIGNED  NOT NULL,
  name          VARCHAR(100)  NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sections_department_id (department_id),
  UNIQUE KEY uq_section_dept_name (department_id, name),
  FOREIGN KEY (department_id) REFERENCES departments(id)
);
```

- [ ] **Step 3: DBを再構築して確認**

```bash
docker-compose down -v
docker-compose up --build -d
docker-compose exec db mysql -u root -proot kousuu_kanri -e "SHOW CREATE TABLE departments\G" 2>/dev/null | grep -A2 "UNIQUE"
```

期待出力に `uq_department_name` が含まれること。

- [ ] **Step 4: コミット**

```bash
git add db/init/01_schema.sql
git commit -m "feat: add unique keys to departments and sections for CSV upsert"
```

---

## Task 2: backend/src/routes/importDepartments.ts を新規作成

**Files:**
- Create: `backend/src/routes/importDepartments.ts`

- [ ] **Step 1: ファイルを作成**

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../db';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

interface ImportError {
  row: number;
  reason: string;
}

// POST /api/v1/import/departments
router.post(
  '/',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      res.status(400).json({ error: 'ファイルが選択されていません' });
      return;
    }

    try {
      const content = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, string>[];

      let imported = 0;
      let skipped  = 0;
      const errors: ImportError[] = [];

      for (let i = 0; i < records.length; i++) {
        const row    = records[i];
        const rowNum = i + 2;
        const deptName = row['department_name'] ?? '';
        const secName  = row['section_name']   ?? '';

        if (!deptName) {
          errors.push({ row: rowNum, reason: 'department_name が空欄です' });
          skipped++;
          continue;
        }

        try {
          // 部を INSERT IGNORE（同名なら既存を使用）
          await pool.query<ResultSetHeader>(
            'INSERT IGNORE INTO departments (name) VALUES (?)',
            [deptName]
          );

          // 部IDを取得
          const [deptRows] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM departments WHERE name = ?',
            [deptName]
          );
          const deptId = deptRows[0].id as number;

          // 課を INSERT IGNORE（同名同部なら既存を使用）
          if (secName) {
            await pool.query<ResultSetHeader>(
              'INSERT IGNORE INTO sections (department_id, name) VALUES (?, ?)',
              [deptId, secName]
            );
          }

          imported++;
        } catch (rowErr) {
          errors.push({ row: rowNum, reason: String(rowErr) });
          skipped++;
        }
      }

      res.json({ total: records.length, imported, skipped, errors });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
```

- [ ] **Step 2: TypeScript コンパイル確認**

```bash
cd backend && npm run build 2>&1 | grep -E "error TS|✓|Error"
```

エラーなし。

- [ ] **Step 3: コミット**

```bash
git add backend/src/routes/importDepartments.ts
git commit -m "feat: add POST /api/v1/import/departments route"
```

---

## Task 3: backend/src/routes/importMembers.ts を新規作成

**Files:**
- Create: `backend/src/routes/importMembers.ts`

- [ ] **Step 1: ファイルを作成**

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { RowDataPacket } from 'mysql2';
import pool from '../db';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

interface ImportError {
  row: number;
  reason: string;
}

// POST /api/v1/import/members
router.post(
  '/',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      res.status(400).json({ error: 'ファイルが選択されていません' });
      return;
    }

    try {
      const content = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, string>[];

      let imported = 0;
      let skipped  = 0;
      const errors: ImportError[] = [];

      for (let i = 0; i < records.length; i++) {
        const row      = records[i];
        const rowNum   = i + 2;
        const code     = row['member_code']     ?? '';
        const name     = row['member_name']     ?? '';
        const unitCost = parseFloat(row['unit_cost'] ?? '0') || 0;
        const deptName = row['department_name'] ?? '';
        const secName  = row['section_name']    ?? '';

        if (!code) {
          errors.push({ row: rowNum, reason: 'member_code が空欄です' });
          skipped++;
          continue;
        }
        if (!name) {
          errors.push({ row: rowNum, reason: 'member_name が空欄です' });
          skipped++;
          continue;
        }

        try {
          // section_id を解決
          let sectionId: number | null = null;

          if (deptName && secName) {
            // 部名 + 課名でDBを検索
            const [secRows] = await pool.query<RowDataPacket[]>(
              `SELECT s.id FROM sections s
               JOIN departments d ON s.department_id = d.id
               WHERE d.name = ? AND s.name = ?`,
              [deptName, secName]
            );
            if (!secRows.length) {
              errors.push({ row: rowNum, reason: `部名または課名が見つかりません: ${deptName} / ${secName}` });
              skipped++;
              continue;
            }
            sectionId = secRows[0].id as number;
          } else if (deptName && !secName) {
            // 部名のみ指定 → 部の存在確認のみ行い section_id は NULL
            const [deptRows] = await pool.query<RowDataPacket[]>(
              'SELECT id FROM departments WHERE name = ?',
              [deptName]
            );
            if (!deptRows.length) {
              errors.push({ row: rowNum, reason: `部名が見つかりません: ${deptName}` });
              skipped++;
              continue;
            }
            sectionId = null;
          }
          // deptName も secName も空の場合は sectionId = null のまま

          // member_code で UPSERT
          await pool.query(
            `INSERT INTO members (code, name, unit_cost, section_id)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               name       = VALUES(name),
               unit_cost  = VALUES(unit_cost),
               section_id = VALUES(section_id)`,
            [code, name, unitCost, sectionId]
          );

          imported++;
        } catch (rowErr) {
          errors.push({ row: rowNum, reason: String(rowErr) });
          skipped++;
        }
      }

      res.json({ total: records.length, imported, skipped, errors });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
```

- [ ] **Step 2: TypeScript コンパイル確認**

```bash
cd backend && npm run build 2>&1 | grep -E "error TS|✓|Error"
```

エラーなし。

- [ ] **Step 3: コミット**

```bash
git add backend/src/routes/importMembers.ts
git commit -m "feat: add POST /api/v1/import/members route"
```

---

## Task 4: backend/src/index.ts にルートを登録

**Files:**
- Modify: `backend/src/index.ts`

- [ ] **Step 1: インポートと登録を追加**

`backend/src/index.ts` の既存の import 行群の末尾に追加:

```typescript
import importDepartmentsRouter from './routes/importDepartments';
import importMembersRouter     from './routes/importMembers';
```

`app.use('/api/v1/import', importRouter);` の次の行に追加:

```typescript
app.use('/api/v1/import/departments', importDepartmentsRouter);
app.use('/api/v1/import/members',     importMembersRouter);
```

- [ ] **Step 2: TypeScript コンパイル確認**

```bash
cd backend && npm run build 2>&1 | grep -E "error TS|✓|Error"
```

エラーなし。

- [ ] **Step 3: コミット**

```bash
git add backend/src/index.ts
git commit -m "feat: register import/departments and import/members routes"
```

---

## Task 5: frontend/src/api/client.ts に API を追加

**Files:**
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: importDepartmentsCsv と importMembersCsv を追加**

`frontend/src/api/client.ts` の `importCsv` の直後に追加:

```typescript
  importDepartmentsCsv: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return req<ImportResult>('/import/departments', { method: 'POST', body: form });
  },

  importMembersCsv: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return req<ImportResult>('/import/members', { method: 'POST', body: form });
  },
```

- [ ] **Step 2: コミット**

```bash
git add frontend/src/api/client.ts
git commit -m "feat: add importDepartmentsCsv and importMembersCsv to api client"
```

---

## Task 6: frontend/src/pages/ImportPage.tsx をタブ化

**Files:**
- Modify: `frontend/src/pages/ImportPage.tsx`

- [ ] **Step 1: ImportPage.tsx を書き換え**

```typescript
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ImportResult } from '../types';

type Tab = 'work_hours' | 'departments' | 'members';

const WORK_HOURS_SAMPLES = {
  planned: `member_code,year,month,type,hours,note\nM001,2026,4,planned,160,\nM002,2026,4,planned,168,`,
  actual:  `member_code,year,month,type,hours,note\nM001,2026,4,actual,152.5,残業あり\nM002,2026,4,actual,168,`,
  mixed:   `member_code,year,month,type,hours,note\nM001,2026,4,planned,160,\nM001,2026,4,actual,152.5,\nM002,2026,4,planned,168,`,
};
type WorkHoursSampleKey = keyof typeof WORK_HOURS_SAMPLES;

const DEPT_SAMPLE = `department_name,section_name\nテクノロジー本部,プラットフォーム開発課\nテクノロジー本部,SRE課\nテクノロジー本部,\nビジネス本部,営業企画課`;

const MEMBER_SAMPLE = `member_code,member_name,unit_cost,department_name,section_name\nM001,田中太郎,5000,テクノロジー本部,プラットフォーム開発課\nM002,山田花子,5500,,\nM003,佐藤次郎,4800,テクノロジー本部,`;

function ResultPanel({ result }: { result: ImportResult }) {
  return (
    <div className="card space-y-3">
      <h3 className="font-semibold">取込結果</h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-gray-800">{result.total}</div>
          <div className="text-xs text-gray-500">総行数</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{result.imported}</div>
          <div className="text-xs text-gray-500">取込成功</div>
        </div>
        <div className={`rounded-lg p-3 text-center ${result.skipped > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
          <div className={`text-2xl font-bold ${result.skipped > 0 ? 'text-red-700' : 'text-gray-800'}`}>{result.skipped}</div>
          <div className="text-xs text-gray-500">スキップ</div>
        </div>
      </div>
      {result.errors.length > 0 && (
        <div>
          <p className="text-sm font-medium text-red-700 mb-2">エラー詳細</p>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-48 overflow-y-auto">
            {result.errors.map((e, i) => (
              <p key={i} className="text-xs text-red-700 font-mono">{e.row}行目: {e.reason}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkHoursTab() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file,     setFile]     = useState<File | null>(null);
  const [result,   setResult]   = useState<ImportResult | null>(null);
  const [sample,   setSample]   = useState<WorkHoursSampleKey>('planned');
  const [dragOver, setDragOver] = useState(false);

  const mutation = useMutation({
    mutationFn: (f: File) => api.importCsv(f),
    onSuccess: data => {
      setResult(data);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      qc.invalidateQueries({ queryKey: ['monthly-report'] });
      qc.invalidateQueries({ queryKey: ['annual-report'] });
    },
  });

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) setFile(f);
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h3 className="font-semibold">CSVフォーマット仕様</h3>
        <div className="flex gap-2">
          {(Object.keys(WORK_HOURS_SAMPLES) as WorkHoursSampleKey[]).map(k => (
            <button key={k} className={`btn ${sample === k ? 'btn-primary' : 'btn-secondary'} text-xs`}
              onClick={() => setSample(k)}>
              {k === 'planned' ? '予定工数' : k === 'actual' ? '実績工数' : '混在'}
            </button>
          ))}
        </div>
        <pre className="bg-gray-100 rounded-lg p-3 text-xs font-mono overflow-x-auto">
          {WORK_HOURS_SAMPLES[sample]}
        </pre>
        <div className="text-xs text-gray-500 space-y-1">
          <p><strong>必須列：</strong> member_code または member_name、year、month、type（planned/actual）、hours</p>
          <p><strong>任意列：</strong> note（備考）</p>
          <p><strong>文字コード：</strong> UTF-8（BOM付き可）</p>
          <p><strong>重複行：</strong> 同一メンバー・年月・typeの場合、後勝ち（UPSERT）</p>
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="font-semibold">ファイル選択</h3>
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
            dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
          }`}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <p className="text-gray-500">
            {file
              ? <span className="text-blue-700 font-medium">{file.name}</span>
              : <>CSVファイルをドロップ、または<span className="text-blue-600 underline">クリックして選択</span></>
            }
          </p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
        </div>
        <div className="flex gap-3">
          <button className="btn-primary" disabled={!file || mutation.isPending}
            onClick={() => file && mutation.mutate(file)}>
            {mutation.isPending ? '取込中...' : '取込実行'}
          </button>
          {file && (
            <button className="btn-secondary"
              onClick={() => { setFile(null); setResult(null); if (fileRef.current) fileRef.current.value = ''; }}>
              クリア
            </button>
          )}
        </div>
        {mutation.isError && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-red-700 text-sm">
            エラー: {mutation.error instanceof Error ? mutation.error.message : String(mutation.error)}
          </div>
        )}
      </div>

      {result && <ResultPanel result={result} />}
    </div>
  );
}

function DepartmentsImportTab() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file,     setFile]     = useState<File | null>(null);
  const [result,   setResult]   = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const mutation = useMutation({
    mutationFn: (f: File) => api.importDepartmentsCsv(f),
    onSuccess: data => {
      setResult(data);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      qc.invalidateQueries({ queryKey: ['departments'] });
    },
  });

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) setFile(f);
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h3 className="font-semibold">CSVフォーマット仕様</h3>
        <pre className="bg-gray-100 rounded-lg p-3 text-xs font-mono overflow-x-auto">
          {DEPT_SAMPLE}
        </pre>
        <div className="text-xs text-gray-500 space-y-1">
          <p><strong>必須列：</strong> department_name</p>
          <p><strong>任意列：</strong> section_name（空欄の場合は部だけ登録）</p>
          <p><strong>文字コード：</strong> UTF-8（BOM付き可）</p>
          <p><strong>重複：</strong> 同名の部・課は既存を使用（スキップ）</p>
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="font-semibold">ファイル選択</h3>
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
            dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
          }`}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <p className="text-gray-500">
            {file
              ? <span className="text-blue-700 font-medium">{file.name}</span>
              : <>CSVファイルをドロップ、または<span className="text-blue-600 underline">クリックして選択</span></>
            }
          </p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
        </div>
        <div className="flex gap-3">
          <button className="btn-primary" disabled={!file || mutation.isPending}
            onClick={() => file && mutation.mutate(file)}>
            {mutation.isPending ? '取込中...' : '取込実行'}
          </button>
          {file && (
            <button className="btn-secondary"
              onClick={() => { setFile(null); setResult(null); if (fileRef.current) fileRef.current.value = ''; }}>
              クリア
            </button>
          )}
        </div>
        {mutation.isError && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-red-700 text-sm">
            エラー: {mutation.error instanceof Error ? mutation.error.message : String(mutation.error)}
          </div>
        )}
      </div>

      {result && <ResultPanel result={result} />}
    </div>
  );
}

function MembersImportTab() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file,     setFile]     = useState<File | null>(null);
  const [result,   setResult]   = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const mutation = useMutation({
    mutationFn: (f: File) => api.importMembersCsv(f),
    onSuccess: data => {
      setResult(data);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      qc.invalidateQueries({ queryKey: ['members'] });
      qc.invalidateQueries({ queryKey: ['departments'] });
    },
  });

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) setFile(f);
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h3 className="font-semibold">CSVフォーマット仕様</h3>
        <pre className="bg-gray-100 rounded-lg p-3 text-xs font-mono overflow-x-auto">
          {MEMBER_SAMPLE}
        </pre>
        <div className="text-xs text-gray-500 space-y-1">
          <p><strong>必須列：</strong> member_code、member_name</p>
          <p><strong>任意列：</strong> unit_cost（省略時は 0）、department_name、section_name</p>
          <p><strong>文字コード：</strong> UTF-8（BOM付き可）</p>
          <p><strong>重複：</strong> member_code が一致する場合、氏名・単価・所属課を更新（UPSERT）</p>
          <p><strong>所属解決：</strong> department_name + section_name でDBを検索。存在しない場合はその行をスキップ</p>
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="font-semibold">ファイル選択</h3>
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
            dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
          }`}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <p className="text-gray-500">
            {file
              ? <span className="text-blue-700 font-medium">{file.name}</span>
              : <>CSVファイルをドロップ、または<span className="text-blue-600 underline">クリックして選択</span></>
            }
          </p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
        </div>
        <div className="flex gap-3">
          <button className="btn-primary" disabled={!file || mutation.isPending}
            onClick={() => file && mutation.mutate(file)}>
            {mutation.isPending ? '取込中...' : '取込実行'}
          </button>
          {file && (
            <button className="btn-secondary"
              onClick={() => { setFile(null); setResult(null); if (fileRef.current) fileRef.current.value = ''; }}>
              クリア
            </button>
          )}
        </div>
        {mutation.isError && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-red-700 text-sm">
            エラー: {mutation.error instanceof Error ? mutation.error.message : String(mutation.error)}
          </div>
        )}
      </div>

      {result && <ResultPanel result={result} />}
    </div>
  );
}

export default function ImportPage() {
  const [tab, setTab] = useState<Tab>('work_hours');

  return (
    <div className="space-y-5 max-w-3xl">
      <h2 className="text-xl font-bold text-gray-800">CSV取込</h2>

      <div className="flex gap-1 border-b border-gray-200">
        {([['work_hours', '工数'], ['departments', '部・課マスタ'], ['members', 'メンバー']] as [Tab, string][]).map(([t, label]) => (
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

      {tab === 'work_hours'  && <WorkHoursTab />}
      {tab === 'departments' && <DepartmentsImportTab />}
      {tab === 'members'     && <MembersImportTab />}
    </div>
  );
}
```

- [ ] **Step 2: フロントエンド TypeScript ビルド確認**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

エラーなし（`✓ built in` が表示されること）。

- [ ] **Step 3: コミット**

```bash
git add frontend/src/pages/ImportPage.tsx
git commit -m "feat: add dept/member import tabs to ImportPage"
```

---

## Self-Review チェックリスト

- [x] **スペックカバレッジ:** departments UNIQUE KEY ✓、POST /import/departments ✓、POST /import/members ✓、3タブ化 ✓、キャッシュ無効化（departments/members）✓
- [x] **型整合性:** `ImportResult` 型は既存のまま使用。`importDepartmentsCsv` / `importMembersCsv` の戻り値も `ImportResult`
- [x] **プレースホルダーなし:** 全ステップに完全なコードあり
- [x] **既存工数取込への影響なし:** `WorkHoursTab` は現 ImportPage のロジックをそのまま移植
