export interface Member {
  id: number;
  code: string;
  name: string;
  unit_cost: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MonthlyMemberRow {
  id: number;
  code: string;
  name: string;
  unit_cost: number;
  planned_hours: number | null;
  actual_hours: number | null;
  note: string | null;
  missingPlanned: boolean;
  planned_cost: number | null;
  actual_cost: number | null;
}

export interface MonthlyReport {
  year: number;
  month: number;
  deadline_day: number;
  is_past_deadline: boolean;
  members: MonthlyMemberRow[];
}

export interface AnnualMonthData {
  year: number;
  month: number;
  label: string;
  planned_hours: number | null;
  actual_hours: number | null;
  planned_cost: number | null;
  actual_cost: number | null;
}

export interface AnnualMemberRow {
  member_id: number;
  member_code: string;
  member_name: string;
  unit_cost: number;
  months: AnnualMonthData[];
  total_planned_hours: number;
  total_actual_hours: number;
  total_planned_cost: number;
  total_actual_cost: number;
}

export interface AnnualReport {
  fiscal_year: number;
  fy_start_month: number;
  month_labels: string[];
  members: AnnualMemberRow[];
}

export interface ConfigEntry {
  value: string;
  description: string | null;
}

export type ConfigMap = Record<string, ConfigEntry>;

export interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
}
