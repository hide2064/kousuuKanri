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
              <label className="block text-xs text-gray-500 mb-1">コード <span className="text-red-500">*</span></label>
              <input className="input w-full" value={newForm.code} placeholder="M001"
                onChange={e => setNewForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">氏名 <span className="text-red-500">*</span></label>
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
            <p className="text-red-600 text-sm">
              {createMutation.error instanceof Error ? createMutation.error.message : String(createMutation.error)}
            </p>
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
