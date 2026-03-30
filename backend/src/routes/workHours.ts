import { Router } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../db';

const router = Router();

// GET /api/v1/work-hours?year=&month=
router.get('/', async (req, res, next) => {
  try {
    const { year, month } = req.query;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT wh.*, m.name AS member_name, m.code AS member_code
       FROM work_hours wh JOIN members m ON m.id = wh.member_id
       WHERE wh.year = ? AND wh.month = ?
       ORDER BY m.name`,
      [year, month]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/work-hours/:memberId/:year/:month
router.put('/:memberId/:year/:month', async (req, res, next) => {
  try {
    const { memberId, year, month } = req.params;
    const { planned_hours, actual_hours, note } = req.body as {
      planned_hours?: number | null;
      actual_hours?: number | null;
      note?: string;
    };
    await pool.query(
      `INSERT INTO work_hours (member_id, year, month, planned_hours, actual_hours, note)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         planned_hours = COALESCE(VALUES(planned_hours), planned_hours),
         actual_hours  = COALESCE(VALUES(actual_hours),  actual_hours),
         note          = COALESCE(VALUES(note), note)`,
      [memberId, year, month, planned_hours ?? null, actual_hours ?? null, note ?? null]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
