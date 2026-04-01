import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Department } from '../types';

export default function DepartmentsTab() {
  const qc = useQueryClient();
  const { data: departments = [], isLoading, error } = useQuery({
    queryKey: ['departments'],
    queryFn: api.getDepartments,
  });

  const [editDeptId,      setEditDeptId]      = useState<number | null>(null);
  const [editDeptName,    setEditDeptName]    = useState('');
  const [editSectionId,   setEditSectionId]   = useState<number | null>(null);
  const [editSectionName, setEditSectionName] = useState('');
  const [addingDept,            setAddingDept]            = useState(false);
  const [newDeptName,           setNewDeptName]           = useState('');
  const [addingSectionForDept,  setAddingSectionForDept]  = useState<number | null>(null);
  const [newSectionName,        setNewSectionName]        = useState('');
  const [errorMsg,              setErrorMsg]              = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['departments'] });

  const createDeptMut = useMutation({
    mutationFn: (name: string) => api.createDepartment(name),
    onSuccess: () => { invalidate(); setNewDeptName(''); setAddingDept(false); },
  });

  const updateDeptMut = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => api.updateDepartment(id, name),
    onSuccess: () => { invalidate(); setEditDeptId(null); },
  });

  const deleteDeptMut = useMutation({
    mutationFn: (id: number) => api.deleteDepartment(id),
    onSuccess: () => invalidate(),
    onError: (e: Error) => setErrorMsg(e.message),
  });

  const createSecMut = useMutation({
    mutationFn: ({ deptId, name }: { deptId: number; name: string }) =>
      api.createSection(deptId, name),
    onSuccess: () => { invalidate(); setNewSectionName(''); setAddingSectionForDept(null); },
  });

  const updateSecMut = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => api.updateSection(id, name),
    onSuccess: () => { invalidate(); setEditSectionId(null); },
  });

  const deleteSecMut = useMutation({
    mutationFn: (id: number) => api.deleteSection(id),
    onSuccess: () => invalidate(),
    onError: (e: Error) => setErrorMsg(e.message),
  });

  if (isLoading) return <p className="p-4 text-gray-500">読み込み中...</p>;
  if (error)     return <p className="p-4 text-red-600">エラー: {String(error)}</p>;

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-2 text-red-700 text-sm flex justify-between">
          <span>{errorMsg}</span>
          <button className="ml-4 text-red-400 hover:text-red-600" onClick={() => setErrorMsg(null)}>✕</button>
        </div>
      )}

      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setAddingDept(true)}>+ 部を追加</button>
      </div>

      {addingDept && (
        <div className="card flex items-center gap-2">
          <input
            className="input flex-1"
            placeholder="部の名称"
            value={newDeptName}
            autoFocus
            onChange={e => setNewDeptName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newDeptName) createDeptMut.mutate(newDeptName);
              if (e.key === 'Escape') { setAddingDept(false); setNewDeptName(''); }
            }}
          />
          <button className="btn-primary text-xs py-1 px-3"
            disabled={!newDeptName} onClick={() => createDeptMut.mutate(newDeptName)}>登録</button>
          <button className="btn-secondary text-xs py-1 px-3"
            onClick={() => { setAddingDept(false); setNewDeptName(''); }}>戻る</button>
        </div>
      )}

      {departments.map((dept: Department) => (
        <div key={dept.id} className="card space-y-3">
          {/* 部ヘッダー */}
          <div className="flex items-center gap-2">
            {editDeptId === dept.id ? (
              <>
                <input
                  className="input flex-1"
                  value={editDeptName}
                  autoFocus
                  onChange={e => setEditDeptName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') updateDeptMut.mutate({ id: dept.id, name: editDeptName });
                    if (e.key === 'Escape') setEditDeptId(null);
                  }}
                />
                <button className="btn-primary text-xs py-1 px-3"
                  onClick={() => updateDeptMut.mutate({ id: dept.id, name: editDeptName })}>保存</button>
                <button className="btn-secondary text-xs py-1 px-3"
                  onClick={() => setEditDeptId(null)}>戻る</button>
              </>
            ) : (
              <>
                <span className="font-semibold text-gray-800 flex-1">▼ {dept.name}</span>
                <button className="btn-secondary text-xs py-1 px-2"
                  onClick={() => { setEditDeptId(dept.id); setEditDeptName(dept.name); }}>編集</button>
                <button className="btn-danger text-xs py-1 px-2"
                  onClick={() => {
                    if (confirm(`「${dept.name}」を削除しますか？`)) {
                      setErrorMsg(null);
                      deleteDeptMut.mutate(dept.id);
                    }
                  }}>削除</button>
              </>
            )}
          </div>

          {/* 課一覧 */}
          <div className="ml-4 space-y-2">
            {dept.sections.map(sec => (
              <div key={sec.id} className="flex items-center gap-2">
                {editSectionId === sec.id ? (
                  <>
                    <span className="text-gray-400 text-sm w-3">└</span>
                    <input
                      className="input flex-1"
                      value={editSectionName}
                      autoFocus
                      onChange={e => setEditSectionName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') updateSecMut.mutate({ id: sec.id, name: editSectionName });
                        if (e.key === 'Escape') setEditSectionId(null);
                      }}
                    />
                    <button className="btn-primary text-xs py-1 px-3"
                      onClick={() => updateSecMut.mutate({ id: sec.id, name: editSectionName })}>保存</button>
                    <button className="btn-secondary text-xs py-1 px-3"
                      onClick={() => setEditSectionId(null)}>戻る</button>
                  </>
                ) : (
                  <>
                    <span className="text-gray-400 text-sm w-3">└</span>
                    <span className="flex-1 text-gray-700">{sec.name}</span>
                    <button className="btn-secondary text-xs py-1 px-2"
                      onClick={() => { setEditSectionId(sec.id); setEditSectionName(sec.name); }}>編集</button>
                    <button className="btn-danger text-xs py-1 px-2"
                      onClick={() => {
                        if (confirm(`「${sec.name}」を削除しますか？`)) {
                          setErrorMsg(null);
                          deleteSecMut.mutate(sec.id);
                        }
                      }}>削除</button>
                  </>
                )}
              </div>
            ))}

            {/* 課追加フォーム */}
            {addingSectionForDept === dept.id ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm w-3">└</span>
                <input
                  className="input flex-1"
                  placeholder="課の名称"
                  value={newSectionName}
                  autoFocus
                  onChange={e => setNewSectionName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newSectionName)
                      createSecMut.mutate({ deptId: dept.id, name: newSectionName });
                    if (e.key === 'Escape') { setAddingSectionForDept(null); setNewSectionName(''); }
                  }}
                />
                <button className="btn-primary text-xs py-1 px-3"
                  disabled={!newSectionName}
                  onClick={() => createSecMut.mutate({ deptId: dept.id, name: newSectionName })}>登録</button>
                <button className="btn-secondary text-xs py-1 px-3"
                  onClick={() => { setAddingSectionForDept(null); setNewSectionName(''); }}>戻る</button>
              </div>
            ) : (
              <button
                className="text-blue-500 text-xs hover:underline ml-4"
                onClick={() => { setAddingSectionForDept(dept.id); setNewSectionName(''); }}
              >
                + 課を追加
              </button>
            )}
          </div>
        </div>
      ))}

      {departments.length === 0 && !addingDept && (
        <p className="text-gray-400 text-sm text-center py-4">部が登録されていません。</p>
      )}
    </div>
  );
}
