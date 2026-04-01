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
