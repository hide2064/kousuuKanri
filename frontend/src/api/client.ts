import type { Member, MonthlyReport, AnnualReport, ConfigMap, ImportResult } from '../types';

const BASE = '/api/v1';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function json(method: string, body: unknown, extra?: RequestInit): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...extra,
  };
}

export const api = {
  /* ---------- Reports ---------- */
  getMonthlyReport: (year: number, month: number) =>
    req<MonthlyReport>(`/reports/monthly?year=${year}&month=${month}`),

  getAnnualReport: (fiscalYear: number) =>
    req<AnnualReport>(`/reports/annual?fiscal_year=${fiscalYear}`),

  /* ---------- Members ---------- */
  getMembers: (activeOnly = false) =>
    req<Member[]>(`/members${activeOnly ? '?active=1' : ''}`),

  createMember: (data: Pick<Member, 'code' | 'name' | 'unit_cost'>) =>
    req<Member>('/members', json('POST', data)),

  updateMember: (id: number, data: Partial<Member>) =>
    req<{ success: boolean }>(`/members/${id}`, json('PUT', data)),

  deleteMember: (id: number) =>
    req<{ success: boolean }>(`/members/${id}`, { method: 'DELETE' }),

  /* ---------- Config ---------- */
  getConfig: () => req<ConfigMap>('/config'),

  updateConfig: (key: string, value: string) =>
    req<{ success: boolean }>(`/config/${encodeURIComponent(key)}`, json('PUT', { value })),

  /* ---------- Import ---------- */
  importCsv: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return req<ImportResult>('/import/csv', { method: 'POST', body: form });
  },
};
