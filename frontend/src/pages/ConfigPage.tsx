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
