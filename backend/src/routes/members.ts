import { Router } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../db';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const activeOnly = req.query.active === '1';
    const where = activeOnly ? 'WHERE m.active = 1' : '';
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT m.id, m.code, m.name, m.unit_cost, m.section_id, m.active, m.created_at, m.updated_at,
              s.name AS section_name, s.department_id,
              d.name AS department_name
       FROM members m
       LEFT JOIN sections s ON s.id = m.section_id
       LEFT JOIN departments d ON d.id = s.department_id
       ${where}
       ORDER BY m.name`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { code, name, unit_cost, section_id } = req.body as {
      code: string;
      name: string;
      unit_cost?: number;
      section_id?: number | null;
    };
    if (!code || !name) {
      res.status(400).json({ error: 'code と name は必須です' });
      return;
    }
    const [result] = await pool.query(
      'INSERT INTO members (code, name, unit_cost, section_id) VALUES (?, ?, ?, ?)',
      [code, name, unit_cost ?? 0, section_id ?? null]
    );
    const id = (result as any).insertId;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT m.*, s.name AS section_name, s.department_id, d.name AS department_name
       FROM members m
       LEFT JOIN sections s ON s.id = m.section_id
       LEFT JOIN departments d ON d.id = s.department_id
       WHERE m.id = ?`,
      [id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { code, name, unit_cost, active } = req.body as {
      code?: string;
      name?: string;
      unit_cost?: number;
      active?: boolean;
    };
    // section_id は明示的に null を許容するため 'in' で存在確認
    const hasSectionId = 'section_id' in req.body;
    const section_id: number | null | undefined = hasSectionId
      ? (req.body.section_id ?? null)
      : undefined;

    if (hasSectionId) {
      await pool.query(
        `UPDATE members SET
          code      = COALESCE(?, code),
          name      = COALESCE(?, name),
          unit_cost = COALESCE(?, unit_cost),
          active    = COALESCE(?, active),
          section_id = ?
         WHERE id = ?`,
        [code ?? null, name ?? null, unit_cost ?? null,
         active != null ? (active ? 1 : 0) : null, section_id, req.params.id]
      );
    } else {
      await pool.query(
        `UPDATE members SET
          code      = COALESCE(?, code),
          name      = COALESCE(?, name),
          unit_cost = COALESCE(?, unit_cost),
          active    = COALESCE(?, active)
         WHERE id = ?`,
        [code ?? null, name ?? null, unit_cost ?? null,
         active != null ? (active ? 1 : 0) : null, req.params.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('UPDATE members SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
