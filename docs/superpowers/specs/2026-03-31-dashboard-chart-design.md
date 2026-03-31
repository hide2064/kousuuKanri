# ダッシュボード グラフ表示 設計書

Date: 2026-03-31

## 概要

ダッシュボードにグラフ表示機能を追加する。棒グラフ・折れ線グラフ・円グラフの3種類をボタンで切り替えられるようにし、既存のメンバーテーブルと左右に並べて配置する。

---

## レイアウト

```
[サマリーカード 4枚（横並び）]

[グラフエリア (左60%)] | [メンバーテーブル (右40%)]
  [棒] [折れ線] [円]   |  既存のテーブルそのまま
  [グラフ本体]         |
```

- サマリーカード4枚は上部に残す（変更なし）
- その下を `flex` で左右分割
- グラフエリア: 幅60%
- メンバーテーブル: 幅40%（既存コードをそのまま移動）

---

## グラフ仕様

### 棒グラフ（予定 vs 実績）

| 項目 | 内容 |
|------|------|
| X軸 | メンバー名 |
| Y軸 | 工数（時間） |
| 系列 | 予定工数（青）/ 実績工数（緑）を2本並び |
| データ元 | 現在選択中の年月の MonthlyReport |

### 折れ線グラフ（月次推移）

| 項目 | 内容 |
|------|------|
| X軸 | 月（選択月を終点とした過去6ヶ月） |
| Y軸 | 工数合計（時間） |
| 系列 | 全メンバー予定合計（青）/ 実績合計（緑） |
| データ元 | `/reports/monthly` を6ヶ月分並列fetch |

### 円グラフ（工数シェア）

| 項目 | 内容 |
|------|------|
| 内容 | メンバーごとの実績工数の割合 |
| データ元 | 現在選択中の年月の MonthlyReport |
| 注意 | 実績工数が全員 null の場合は「データなし」表示 |

---

## コンポーネント設計

### 新規: `frontend/src/components/WorkHoursChart.tsx`

**Props:**
```ts
interface WorkHoursChartProps {
  monthlyReport: MonthlyReport;
  trendData: { month: string; planned: number; actual: number }[];
}
```

**内部状態:**
```ts
const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
```

**責務:**
- 切り替えボタン（棒 / 折れ線 / 円）の表示と状態管理
- 選択中の chartType に応じたグラフの描画
- Recharts の `BarChart` / `LineChart` / `PieChart` を使用

### 変更: `frontend/src/pages/Dashboard.tsx`

- 折れ線グラフ用に過去6ヶ月の月次レポートを並列fetch（`Promise.all`）
- trendData を計算して `WorkHoursChart` に渡す
- レイアウトを `flex gap-4` で左右分割
  - 左カラム（`flex-[3]`）: `WorkHoursChart`
  - 右カラム（`flex-[2]`）: 既存メンバーテーブル

---

## 追加パッケージ

```bash
npm install recharts
npm install --save-dev @types/recharts  # 不要な場合あり（recharts は型定義内包）
```

`recharts` のみ。他の依存追加なし。

---

## エラーハンドリング

| ケース | 対応 |
|--------|------|
| 折れ線用の過去月fetchが一部失敗 | 失敗した月をスキップし、取得できた月のみ表示 |
| 実績工数が全員 null | 円グラフで「データなし」メッセージを表示 |
| 予定・実績ともに null | 棒グラフ・折れ線でも値0として扱う |

---

## 変更ファイル一覧

| ファイル | 変更種別 |
|---------|---------|
| `frontend/src/components/WorkHoursChart.tsx` | 新規作成 |
| `frontend/src/pages/Dashboard.tsx` | 変更（fetch追加、レイアウト変更） |
| `frontend/package.json` | recharts 追加 |
