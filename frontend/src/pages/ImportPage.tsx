import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ImportResult } from '../types';

const CSV_SAMPLES = {
  planned: `member_code,year,month,type,hours,note\nM001,2026,4,planned,160,\nM002,2026,4,planned,168,`,
  actual:  `member_code,year,month,type,hours,note\nM001,2026,4,actual,152.5,残業あり\nM002,2026,4,actual,168,`,
  mixed:   `member_code,year,month,type,hours,note\nM001,2026,4,planned,160,\nM001,2026,4,actual,152.5,\nM002,2026,4,planned,168,`,
};

type SampleKey = keyof typeof CSV_SAMPLES;

export default function ImportPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file,    setFile]    = useState<File | null>(null);
  const [result,  setResult]  = useState<ImportResult | null>(null);
  const [sample,  setSample]  = useState<SampleKey>('planned');
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
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-xl font-bold text-gray-800">CSV取込</h2>

      {/* Format spec */}
      <div className="card space-y-3">
        <h3 className="font-semibold">CSVフォーマット仕様</h3>
        <div className="flex gap-2">
          {(Object.keys(CSV_SAMPLES) as SampleKey[]).map(k => (
            <button key={k} className={`btn ${sample === k ? 'btn-primary' : 'btn-secondary'} text-xs`}
              onClick={() => setSample(k)}>
              {k === 'planned' ? '予定工数' : k === 'actual' ? '実績工数' : '混在'}
            </button>
          ))}
        </div>
        <pre className="bg-gray-100 rounded-lg p-3 text-xs font-mono overflow-x-auto">
          {CSV_SAMPLES[sample]}
        </pre>
        <div className="text-xs text-gray-500 space-y-1">
          <p><strong>必須列：</strong> member_code または member_name（どちらか一方）、year、month、type（planned/actual）、hours</p>
          <p><strong>任意列：</strong> note（備考）</p>
          <p><strong>文字コード：</strong> UTF-8（BOM付き可）</p>
          <p><strong>ファイルサイズ：</strong> 5MB 以内</p>
          <p><strong>重複行：</strong> 同一メンバー・年月・typeの場合、後勝ち（UPSERT）</p>
        </div>
      </div>

      {/* Upload area */}
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
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); }}
          />
        </div>

        <div className="flex gap-3">
          <button
            className="btn-primary"
            disabled={!file || mutation.isPending}
            onClick={() => file && mutation.mutate(file)}
          >
            {mutation.isPending ? '取込中...' : '取込実行'}
          </button>
          {file && (
            <button className="btn-secondary" onClick={() => { setFile(null); setResult(null); if (fileRef.current) fileRef.current.value = ''; }}>
              クリア
            </button>
          )}
        </div>

        {mutation.isError && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-red-700 text-sm">
            エラー: {String(mutation.error)}
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
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
      )}
    </div>
  );
}
