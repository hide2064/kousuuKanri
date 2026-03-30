import { Router } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../db';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const activeOnly = req.query.active === '1';
    const sql = activeOnly
      ? 'SELECT * FROM members WHERE active = 1 ORDER BY name'
      : 'SELECT * FROM members ORDER BY name';
    const [rows] = await pool.query<RowDataPacket[]>(sql);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { code, name, unit_cost } = req.body as {
      code: string;
      name: string;
      unit_cost?: number;
    };
    if (!code || !name) {
      res.status(400).json({ error: 'code と name は必須です' });
      return;
    }
    const [result] = await pool.query(
      'INSERT INTO members (code, name, unit_cost) VALUES (?, ?, ?)',
      [code, name, unit_cost ?? 0]
    );
    const id = (result as any).insertId;
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM members WHERE id = ?', [id]);
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
    await pool.query(
      `UPDATE members SET
        code = COALESCE(?, code),
        name = COALESCE(?, name),
        unit_cost = COALESCE(?, unit_cost),
        active = COALESCE(?, active)
       WHERE id = ?`,
      [code ?? null, name ?? null, unit_cost ?? null, active != null ? (active ? 1 : 0) : null, req.params.id]
    );
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
