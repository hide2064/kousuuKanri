import { Router } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../db';
import type { DepartmentSummary, SectionSummary } from '../types';

const router = Router();

async function getConfigValue(key: string, defaultVal: string): Promise<string> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT config_value FROM config WHERE config_key = ?',
    [key]
  );
  return (rows[0] as any)?.config_value ?? defaultVal;
}

// GET /api/v1/reports/monthly?year=2026&month=3
router.get('/monthly', async (req, res, next) => {
  try {
    const year  = parseInt(req.query.year  as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

    const deadlineDay = parseInt(await getConfigValue('planned_hours_deadline_day', '10'));
    const today = new Date();
    const isPastDeadline =
      today.getFullYear() > year ||
      (today.getFullYear() === year && today.getMonth() + 1 > month) ||
      (today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() >= deadlineDay);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT m.id, m.code, m.name, m.unit_cost, m.section_id,
              s.name AS section_name, s.department_id,
              d.name AS department_name,
              wh.planned_hours, wh.actual_hours, wh.note
       FROM members m
       LEFT JOIN sections s ON s.id = m.section_id
       LEFT JOIN departments d ON d.id = s.department_id
       LEFT JOIN work_hours wh ON wh.member_id = m.id AND wh.year = ? AND wh.month = ?
       WHERE m.active = 1
       ORDER BY m.name`,
      [year, month]
    );

    const members = rows.map(row => {
      const planned  = row.planned_hours !== null ? Number(row.planned_hours) : null;
      const actual   = row.actual_hours  !== null ? Number(row.actual_hours)  : null;
      const unitCost = Number(row.unit_cost);
      return {
        id:              row.id,
        code:            row.code,
        name:            row.name,
        unit_cost:       unitCost,
        section_id:      row.section_id ?? null,
        section_name:    row.section_name ?? null,
        department_id:   row.department_id ?? null,
        department_name: row.department_name ?? null,
        planned_hours:   planned,
        actual_hours:    actual,
        note:            row.note ?? null,
        missingPlanned:  isPastDeadline && planned === null,
        planned_cost:    planned !== null ? planned * unitCost : null,
        actual_cost:     actual  !== null ? actual  * unitCost : null,
      };
    });

    // 部・課別集計を members から算出
    const deptMap = new Map<number, {
      department_id: number;
      department_name: string;
      member_count: number;
      total_planned_hours: number;
      total_actual_hours: number;
      total_planned_cost: number;
      total_actual_cost: number;
      sectionMap: Map<number, SectionSummary>;
    }>();

    for (const m of members) {
      if (!m.department_id) continue;
      if (!deptMap.has(m.department_id)) {
        deptMap.set(m.department_id, {
          department_id:       m.department_id,
          department_name:     m.department_name!,
          member_count:        0,
          total_planned_hours: 0,
          total_actual_hours:  0,
          total_planned_cost:  0,
          total_actual_cost:   0,
          sectionMap:          new Map(),
        });
      }
      const dept = deptMap.get(m.department_id)!;
      dept.member_count        += 1;
      dept.total_planned_hours += m.planned_hours ?? 0;
      dept.total_actual_hours  += m.actual_hours  ?? 0;
      dept.total_planned_cost  += m.planned_cost  ?? 0;
      dept.total_actual_cost   += m.actual_cost   ?? 0;

      if (m.section_id) {
        if (!dept.sectionMap.has(m.section_id)) {
          dept.sectionMap.set(m.section_id, {
            section_id:          m.section_id,
            section_name:        m.section_name!,
            member_count:        0,
            total_planned_hours: 0,
            total_actual_hours:  0,
            total_planned_cost:  0,
            total_actual_cost:   0,
          });
        }
        const sec = dept.sectionMap.get(m.section_id)!;
        sec.member_count        += 1;
        sec.total_planned_hours += m.planned_hours ?? 0;
        sec.total_actual_hours  += m.actual_hours  ?? 0;
        sec.total_planned_cost  += m.planned_cost  ?? 0;
        sec.total_actual_cost   += m.actual_cost   ?? 0;
      }
    }

    const department_summary: DepartmentSummary[] = Array.from(deptMap.values()).map(d => ({
      department_id:       d.department_id,
      department_name:     d.department_name,
      member_count:        d.member_count,
      total_planned_hours: d.total_planned_hours,
      total_actual_hours:  d.total_actual_hours,
      total_planned_cost:  d.total_planned_cost,
      total_actual_cost:   d.total_actual_cost,
      sections:            Array.from(d.sectionMap.values()),
    }));

    res.json({ year, month, deadline_day: deadlineDay, is_past_deadline: isPastDeadline, members, department_summary });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/annual?fiscal_year=2025
router.get('/annual', async (req, res, next) => {
  try {
    const fiscalYear = parseInt(req.query.fiscal_year as string) || new Date().getFullYear();
    const fyStart    = parseInt(await getConfigValue('fiscal_year_start_month', '4'));

    // Build list of (year, month) pairs for this fiscal year
    const months: Array<{ year: number; month: number; label: string }> = [];
    for (let m = fyStart; m <= 12; m++)      months.push({ year: fiscalYear,     month: m, label: `${fiscalYear}/${m}` });
    for (let m = 1;       m <  fyStart; m++) months.push({ year: fiscalYear + 1, month: m, label: `${fiscalYear + 1}/${m}` });

    const [memberRows] = await pool.query<RowDataPacket[]>(
      'SELECT id, code, name, unit_cost FROM members WHERE active = 1 ORDER BY name'
    );

    const [hoursRows] = await pool.query<RowDataPacket[]>(
      `SELECT member_id, year, month, planned_hours, actual_hours
       FROM work_hours
       WHERE (year = ? AND month >= ?) OR (year = ? AND month < ?)`,
      [fiscalYear, fyStart, fiscalYear + 1, fyStart]
    );

    const hoursMap = new Map<string, { planned: number | null; actual: number | null }>();
    for (const h of hoursRows) {
      hoursMap.set(`${h.member_id}:${h.year}:${h.month}`, {
        planned: h.planned_hours !== null ? Number(h.planned_hours) : null,
        actual:  h.actual_hours  !== null ? Number(h.actual_hours)  : null,
      });
    }

    const result = memberRows.map(member => {
      const unitCost = Number(member.unit_cost);
      const monthData = months.map(({ year, month, label }) => {
        const h = hoursMap.get(`${member.id}:${year}:${month}`);
        const p = h?.planned ?? null;
        const a = h?.actual  ?? null;
        return {
          year, month, label,
          planned_hours: p,
          actual_hours:  a,
          planned_cost:  p !== null ? p * unitCost : null,
          actual_cost:   a !== null ? a * unitCost : null,
        };
      });

      const totalPlanned = monthData.reduce((s, m) => s + (m.planned_hours ?? 0), 0);
      const totalActual  = monthData.reduce((s, m) => s + (m.actual_hours  ?? 0), 0);

      return {
        member_id:          member.id,
        member_code:        member.code,
        member_name:        member.name,
        unit_cost:          unitCost,
        months:             monthData,
        total_planned_hours: totalPlanned,
        total_actual_hours:  totalActual,
        total_planned_cost:  totalPlanned * unitCost,
        total_actual_cost:   totalActual  * unitCost,
      };
    });

    res.json({
      fiscal_year:      fiscalYear,
      fy_start_month:   fyStart,
      month_labels:     months.map(m => m.label),
      members:          result,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
