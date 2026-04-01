export interface Member {
  id: number;
  code: string;
  name: string;
  unit_cost: number;
  section_id: number | null;
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

export interface WorkHours {
  id: number;
  member_id: number;
  year: number;
  month: number;
  planned_hours: number | null;
  actual_hours: number | null;
  note: string | null;
}

export interface ConfigRow {
  config_key: string;
  config_value: string;
  description: string | null;
}

export interface MonthlyReportRow {
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
