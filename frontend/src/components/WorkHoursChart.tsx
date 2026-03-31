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
      <div>
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

  if (data.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">データなし</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis unit="h" tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v) => typeof v === 'number' ? `${v.toFixed(1)} h` : v} />
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
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis unit="h" tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v) => typeof v === 'number' ? `${v.toFixed(1)} h` : v} />
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
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={raw}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius="70%"
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {raw.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => typeof v === 'number' ? `${v.toFixed(1)} h` : v} />
      </PieChart>
    </ResponsiveContainer>
  );
}
