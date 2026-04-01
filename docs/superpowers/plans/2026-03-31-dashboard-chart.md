# ダッシュボード グラフ表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ダッシュボードに棒・折れ線・円グラフをボタン切り替えで表示し、既存メンバーテーブルと左右分割レイアウトで並べる。

**Architecture:** `recharts` を追加し、新規 `WorkHoursChart.tsx` コンポーネントでグラフ描画を担う。`Dashboard.tsx` は折れ線グラフ用に過去6ヶ月の月次レポートを並列fetchし、グラフとテーブルを flex レイアウトで左右に配置する。

**Tech Stack:** React 18, TypeScript, recharts, @tanstack/react-query v5, Tailwind CSS

---

## ファイル構成

| ファイル | 変更種別 | 責務 |
|---------|---------|------|
| `frontend/src/components/WorkHoursChart.tsx` | 新規作成 | グラフ描画コンポーネント（棒/折れ線/円の切り替え） |
| `frontend/src/pages/Dashboard.tsx` | 変更 | trendData fetch追加、レイアウトを左右分割に変更 |
| `frontend/package.json` | 変更 | recharts 追加 |

---

### Task 1: recharts のインストール

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: recharts をインストール**

```bash
cd frontend && npm install recharts
```

Expected output: `added N packages` (エラーなし)

- [ ] **Step 2: TypeScript ビルドが通ることを確認**

```bash
cd frontend && npm run build
```

Expected: ビルド成功（recharts が正しく解決される）

- [ ] **Step 3: コミット**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: add recharts dependency"
```

---

### Task 2: WorkHoursChart コンポーネントの作成

**Files:**
- Create: `frontend/src/components/WorkHoursChart.tsx`

- [ ] **Step 1: ファイルを作成する**

`frontend/src/components/WorkHoursChart.tsx` を以下の内容で作成:

```tsx
import { useState } from 'react';
import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import type { MonthlyReport } from '../types';

interface WorkHoursChartProps {
  monthlyReport: MonthlyReport;
  trendData: { month: string; planned: number; actual: number }[];
}

type ChartType = 'bar' | 'line' | 'pie';

const BLUE  = '#3b82f6';
const GREEN = '#22c55e';
const PIE_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6',
];

export default function WorkHoursChart({ monthlyReport, trendData }: WorkHoursChartProps) {
  const [chartType, setChartType] = useState<ChartType>('bar');

  return (
    <div className="card h-full flex flex-col">
      {/* 切り替えボタン */}
      <div className="flex gap-2 mb-4">
        {(['bar', 'line', 'pie'] as ChartType[]).map(type => (
          <button
            key={type}
            onClick={() => setChartType(type)}
            className={`px-3 py-1 text-sm rounded border transition-colors ${
              chartType === type
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            {type === 'bar' ? '棒グラフ' : type === 'line' ? '折れ線' : '円グラフ'}
          </button>
        ))}
      </div>

      {/* グラフ本体 */}
      <div className="flex-1 min-h-0" style={{ minHeight: 240 }}>
        {chartType === 'bar'  && <BarChartView  report={monthlyReport} />}
        {chartType === 'line' && <LineChartView trendData={trendData} />}
        {chartType === 'pie'  && <PieChartView  report={monthlyReport} />}
      </div>
    </div>
  );
}

/* ---------- 棒グラフ：メンバー別 予定 vs 実績 ---------- */
function BarChartView({ report }: { report: MonthlyReport }) {
  const data = report.members.map(m => ({
    name: m.name,
    予定: Number(m.planned_hours ?? 0),
    実績: Number(m.actual_hours  ?? 0),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis unit="h" tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v: number) => `${v.toFixed(1)} h`} />
        <Legend />
        <Bar dataKey="予定" fill={BLUE}  />
        <Bar dataKey="実績" fill={GREEN} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------- 折れ線グラフ：月次推移（過去6ヶ月） ---------- */
function LineChartView({ trendData }: { trendData: { month: string; planned: number; actual: number }[] }) {
  if (trendData.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">データなし</div>;
  }

  const data = trendData.map(d => ({
    name: d.month,
    予定合計: d.planned,
    実績合計: d.actual,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis unit="h" tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v: number) => `${v.toFixed(1)} h`} />
        <Legend />
        <Line type="monotone" dataKey="予定合計" stroke={BLUE}  dot={false} />
        <Line type="monotone" dataKey="実績合計" stroke={GREEN} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ---------- 円グラフ：メンバー別実績工数シェア ---------- */
function PieChartView({ report }: { report: MonthlyReport }) {
  const raw = report.members
    .map(m => ({ name: m.name, value: Number(m.actual_hours ?? 0) }))
    .filter(d => d.value > 0);

  if (raw.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">データなし</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={raw}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius="70%"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {raw.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => `${v.toFixed(1)} h`} />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: TypeScript ビルドチェック**

```bash
cd frontend && npm run build
```

Expected: ビルド成功

- [ ] **Step 3: コミット**

```bash
git add frontend/src/components/WorkHoursChart.tsx
git commit -m "feat: add WorkHoursChart component with bar/line/pie toggle"
```

---

### Task 3: Dashboard.tsx の更新（trendData fetch + レイアウト変更）

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Dashboard.tsx を以下の内容に置き換える**

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { MonthlyMemberRow } from '../types';
import WorkHoursChart from '../components/WorkHoursChart';

function fmt(n: number | null, digits = 1) {
  if (n === null) return '—';
  return n.toLocaleString('ja-JP', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtCost(n: number | null) {
  if (n === null) return '—';
  return n.toLocaleString('ja-JP') + ' 円';
}

/** 選択月を終点とした過去6ヶ月（含む）の年月リストを返す */
function getPast6Months(year: number, month: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 1 - (5 - i));
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
}

export default function Dashboard() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['monthly-report', year, month],
    queryFn: () => api.getMonthlyReport(year, month),
  });

  const trendMonths = getPast6Months(year, month);

  const { data: trendData = [] } = useQuery({
    queryKey: ['trend', year, month],
    queryFn: async () => {
      const results = await Promise.allSettled(
        trendMonths.map(m => api.getMonthlyReport(m.year, m.month))
      );
      return results
        .flatMap((r, i) => {
          if (r.status !== 'fulfilled') return [];
          const { year: y, month: mo } = trendMonths[i];
          return [{
            month: `${y}/${String(mo).padStart(2, '0')}`,
            planned: r.value.members.reduce((s, m) => s + Number(m.planned_hours ?? 0), 0),
            actual:  r.value.members.reduce((s, m) => s + Number(m.actual_hours  ?? 0), 0),
          }];
        });
    },
  });

  const members = data?.members ?? [];
  const alertMembers = members.filter(m => m.missingPlanned);
  const showAlert = data?.is_past_deadline && alertMembers.length > 0;

  const totalPlanned     = members.reduce((s, m) => s + Number(m.planned_hours ?? 0), 0);
  const totalActual      = members.reduce((s, m) => s + Number(m.actual_hours  ?? 0), 0);
  const totalPlannedCost = members.reduce((s, m) => s + (m.planned_cost  ?? 0), 0);
  const totalActualCost  = members.reduce((s, m) => s + (m.actual_cost   ?? 0), 0);

  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">ダッシュボード</h2>
        <div className="flex items-center gap-2">
          <select className="select" value={year}  onChange={e => setYear(Number(e.target.value))}>
            {yearOptions.map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
          <select className="select" value={month} onChange={e => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
        </div>
      </div>

      {/* Deadline alert */}
      {showAlert && (
        <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 text-red-700">
          <span className="font-semibold">締日（{data!.deadline_day}日）を過ぎています。</span>
          {'　'}予定工数が未登録のメンバー：
          {alertMembers.map(m => m.name).join('、')}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '予定工数合計', value: fmt(totalPlanned) + ' h' },
          { label: '実績工数合計', value: fmt(totalActual)  + ' h' },
          { label: '予定コスト',   value: fmtCost(totalPlannedCost) },
          { label: '実績コスト',   value: fmtCost(totalActualCost)  },
        ].map(card => (
          <div key={card.label} className="card">
            <div className="text-xs text-gray-500 mb-1">{card.label}</div>
            <div className="text-lg font-bold text-gray-800">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Chart + Table */}
      <div className="flex gap-4 items-start">
        {/* Left: Chart (60%) */}
        <div className="flex-[3] min-w-0">
          {isLoading && <div className="card p-6 text-gray-500">読み込み中...</div>}
          {error     && <div className="card p-6 text-red-600">エラー: {String(error)}</div>}
          {!isLoading && !error && data && (
            <WorkHoursChart monthlyReport={data} trendData={trendData} />
          )}
        </div>

        {/* Right: Table (40%) */}
        <div className="flex-[2] min-w-0 card overflow-x-auto p-0">
          {isLoading && <div className="p-6 text-gray-500">読み込み中...</div>}
          {error     && <div className="p-6 text-red-600">エラー: {String(error)}</div>}
          {!isLoading && !error && (
            <table className="table-base">
              <thead>
                <tr>
                  <th>コード</th>
                  <th>メンバー名</th>
                  <th className="text-right">予定(h)</th>
                  <th className="text-right">実績(h)</th>
                  <th className="text-right">差異(h)</th>
                </tr>
              </thead>
              <tbody>
                {members.map(row => (
                  <MemberRow key={row.id} row={row} isPastDeadline={data?.is_past_deadline ?? false} />
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>合計</td>
                  <td className="text-right">{fmt(totalPlanned)}</td>
                  <td className="text-right">{fmt(totalActual)}</td>
                  <td className="text-right">{fmt(totalActual - totalPlanned)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function MemberRow({ row, isPastDeadline }: { row: MonthlyMemberRow; isPastDeadline: boolean }) {
  const isAlert = isPastDeadline && row.missingPlanned;
  const diff = (row.actual_hours ?? 0) - (row.planned_hours ?? 0);
  const cls = isAlert ? 'row-alert' : '';

  return (
    <tr className={cls}>
      <td>{row.code}</td>
      <td>
        {row.name}
        {isAlert && <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">未登録</span>}
      </td>
      <td className="text-right">{isAlert ? <span className="badge-red">未登録</span> : fmt(row.planned_hours)}</td>
      <td className="text-right">{fmt(row.actual_hours)}</td>
      <td className="text-right">{row.planned_hours !== null ? fmt(diff) : '—'}</td>
    </tr>
  );
}
```

> **注意:** 右側テーブルのコスト列（予定コスト・実績コスト）は幅節約のため削除。合計行も対応。

- [ ] **Step 2: TypeScript ビルドチェック**

```bash
cd frontend && npm run build
```

Expected: ビルド成功、型エラーなし

- [ ] **Step 3: 動作確認（ローカルサーバー起動済みの場合）**

ブラウザで `http://localhost:5173` を開き:
- [ ] ダッシュボードのサマリーカード4枚が上部に表示される
- [ ] 下段が左右に分割されている（グラフ左・テーブル右）
- [ ] 「棒グラフ」ボタンでメンバー別棒グラフが表示される
- [ ] 「折れ線」ボタンで月次推移グラフが表示される
- [ ] 「円グラフ」ボタンで工数シェア円グラフが表示される
- [ ] 実績工数が全員nullの月で円グラフ「データなし」が表示される

- [ ] **Step 4: コミット**

```bash
git add frontend/src/pages/Dashboard.tsx frontend/src/components/WorkHoursChart.tsx
git commit -m "feat: add chart display to dashboard with bar/line/pie toggle"
```

---

## 設計との対応確認

| 設計要件 | 実装箇所 |
|---------|---------|
| 棒グラフ：メンバー別予定vs実績 | `BarChartView` in WorkHoursChart.tsx |
| 折れ線：過去6ヶ月合計推移 | `LineChartView` + `getPast6Months` in Dashboard.tsx |
| 円グラフ：メンバー別実績シェア | `PieChartView` in WorkHoursChart.tsx |
| ボタン切り替え | `useState<ChartType>` in WorkHoursChart.tsx |
| 左60% / 右40% レイアウト | `flex-[3]` / `flex-[2]` in Dashboard.tsx |
| 折れ線fetch失敗時スキップ | `Promise.allSettled` + `flatMap` in Dashboard.tsx |
| 円グラフデータなし表示 | `raw.length === 0` チェック in PieChartView |
| 予定・実績null → 0扱い | `Number(m.planned_hours ?? 0)` |
