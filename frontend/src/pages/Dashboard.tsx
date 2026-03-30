import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { MonthlyMemberRow } from '../types';

function fmt(n: number | null, digits = 1) {
  if (n === null) return '—';
  return n.toLocaleString('ja-JP', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtCost(n: number | null) {
  if (n === null) return '—';
  return n.toLocaleString('ja-JP') + ' 円';
}

export default function Dashboard() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['monthly-report', year, month],
    queryFn: () => api.getMonthlyReport(year, month),
  });

  const members = data?.members ?? [];
  const alertMembers = members.filter(m => m.missingPlanned);
  const showAlert = data?.is_past_deadline && alertMembers.length > 0;

  const totalPlanned     = members.reduce((s, m) => s + (m.planned_hours ?? 0), 0);
  const totalActual      = members.reduce((s, m) => s + (m.actual_hours  ?? 0), 0);
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

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        {isLoading && <div className="p-6 text-gray-500">読み込み中...</div>}
        {error   && <div className="p-6 text-red-600">エラー: {String(error)}</div>}
        {!isLoading && !error && (
          <table className="table-base">
            <thead>
              <tr>
                <th>コード</th>
                <th>メンバー名</th>
                <th className="text-right">予定工数(h)</th>
                <th className="text-right">実績工数(h)</th>
                <th className="text-right">差異(h)</th>
                <th className="text-right">予定コスト</th>
                <th className="text-right">実績コスト</th>
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
                <td className="text-right">{totalPlannedCost.toLocaleString()} 円</td>
                <td className="text-right">{totalActualCost.toLocaleString()} 円</td>
              </tr>
            </tfoot>
          </table>
        )}
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
      <td className="text-right">{fmtCost(row.planned_cost)}</td>
      <td className="text-right">{fmtCost(row.actual_cost)}</td>
    </tr>
  );
}
