export interface Member {
  id: number;
  code: string;
  name: string;
  unit_cost: number;
  active: boolean;
  created_at: string;
  updated_at: string;
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
  planned_hours: number | null;
  actual_hours: number | null;
  note: string | null;
  missingPlanned: boolean;
  planned_cost: number | null;
  actual_cost: number | null;
}
