import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Member } from '../types';

interface FormState {
  code: string;
  name: string;
  unit_cost: string;
}

const EMPTY: FormState = { code: '', name: '', unit_cost: '' };

export default function MembersPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [showAll,    setShowAll]    = useState(false);
  const [editId,     setEditId]     = useState<number | null>(null);
  const [editForm,   setEditForm]   = useState<FormState>(EMPTY);
  const [newForm,    setNewForm]    = useState<FormState>(EMPTY);
  const [showAdd,    setShowAdd]    = useState(false);
  const [fiscalYear, setFiscalYear] = useState(now.getFullYear());

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', showAll],
    queryFn: () => api.getMembers(!showAll),
  });

  const { data: annualData } = useQuery({
    queryKey: ['annual-report', fiscalYear],
    queryFn: () => api.getAnnualReport(fiscalYear),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['members'] });
    qc.invalidateQueries({ queryKey: ['annual-report'] });
  };

  const createMutation = useMutation({
    mutationFn: () => api.createMember({
      code: newForm.code,
      name: newForm.name,
      unit_cost: Number(newForm.unit_cost),
    }),
    onSuccess: () => { invalidate(); setNewForm(EMPTY); setShowAdd(false); },
  });

  const updateMutation = useMutation({
    mutationFn: (id: number) => api.updateMember(id, {
      code:      editForm.code,
      name:      editForm.name,
      unit_cost: Number(editForm.unit_cost),
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
          <div className="grid grid-cols-3 gap-3">
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
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={!newForm.code || !newForm.name}
              onClick={() => createMutation.mutate()}>
              登録
            </button>
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
                  <th className="text-right">単価（円/h）</th>
                  <th>在籍</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id}>
                    {editId === m.id ? (
                      <>
                        <td><input className="input w-24" value={editForm.code}
                          onChange={e => setEditForm(f => ({ ...f, code: e.target.value }))} /></td>
                        <td><input className="input w-36" value={editForm.name}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></td>
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
                        <td className="text-right">{m.unit_cost.toLocaleString()}</td>
                        <td><span className={m.active ? 'text-green-600' : 'text-gray-400'}>{m.active ? '在籍' : '退職'}</span></td>
                        <td className="flex gap-1.5">
                          <button className="btn-secondary text-xs py-1 px-2"
                            onClick={() => { setEditId(m.id); setEditForm({ code: m.code, name: m.name, unit_cost: String(m.unit_cost) }); }}>
                            編集
                          </button>
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

      {/* Cost summary */}
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
    </div>
  );
}
