import { Router } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../db';
import type { ConfigRow } from '../types';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT config_key, config_value, description FROM config ORDER BY config_key'
    );
    const result: Record<string, { value: string; description: string | null }> = {};
    (rows as ConfigRow[]).forEach(r => {
      result[r.config_key] = { value: r.config_value, description: r.description };
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.put('/:key', async (req, res, next) => {
  try {
    const { value } = req.body as { value: string };
    if (value === undefined) {
      res.status(400).json({ error: 'value は必須です' });
      return;
    }
    const [result] = await pool.query(
      'UPDATE config SET config_value = ? WHERE config_key = ?',
      [value, req.params.key]
    );
    if ((result as any).affectedRows === 0) {
      res.status(404).json({ error: 'config key が見つかりません' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
