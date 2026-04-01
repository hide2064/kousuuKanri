export interface Member {
  id: number;
  code: string;
  name: string;
  unit_cost: number;
  section_id: number | null;
  section_name: string | null;
  department_id: number | null;
  department_name: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: number;
  name: string;
  sections: Section[];
}

export interface Section {
  id: number;
  department_id: number;
  name: string;
}

export interface MonthlyMemberRow {
  id: number;
  code: string;
  name: string;
  unit_cost: number;
  section_id: number | null;
  section_name: string | null;
  department_id: number | null;
  department_name: string | null;
  planned_hours: number | null;
  actual_hours: number | null;
  note: string | null;
  missingPlanned: boolean;
  planned_cost: number | null;
  actual_cost: number | null;
}

export interface SectionSummary {
  section_id: number;
  section_name: string;
  member_count: number;
  total_planned_hours: number;
  total_actual_hours: number;
  total_planned_cost: number;
  total_actual_cost: number;
}

export interface DepartmentSummary {
  department_id: number;
  department_name: string;
  member_count: number;
  total_planned_hours: number;
  total_actual_hours: number;
  total_planned_cost: number;
  total_actual_cost: number;
  sections: SectionSummary[];
}

export interface MonthlyReport {
  year: number;
  month: number;
  deadline_day: number;
  is_past_deadline: boolean;
  members: MonthlyMemberRow[];
  department_summary: DepartmentSummary[];
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
