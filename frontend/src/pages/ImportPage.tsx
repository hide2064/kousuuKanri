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
