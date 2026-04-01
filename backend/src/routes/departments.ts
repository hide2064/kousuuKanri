import { Router } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../db';

const router = Router();

// GET /api/v1/departments — 部一覧（課を含む）
router.get('/', async (req, res, next) => {
  try {
    const [deptRows] = await pool.query<RowDataPacket[]>(
      'SELECT id, name FROM departments ORDER BY name'
    );
    const [secRows] = await pool.query<RowDataPacket[]>(
      'SELECT id, department_id, name FROM sections ORDER BY name'
    );
    const result = deptRows.map(d => ({
      id: d.id,
      name: d.name,
      sections: secRows.filter(s => s.department_id === d.id).map(s => ({
        id: s.id,
        department_id: s.department_id,
        name: s.name,
      })),
    }));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/departments — 部の作成
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body as { name: string };
    if (!name) {
      res.status(400).json({ error: 'name は必須です' });
      return;
    }
    const [result] = await pool.query(
      'INSERT INTO departments (name) VALUES (?)',
      [name]
    );
    const id = (result as any).insertId;
    res.status(201).json({ id, name, sections: [] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/departments/:id — 部の更新
router.put('/:id', async (req, res, next) => {
  try {
    const { name } = req.body as { name: string };
    if (!name) {
      res.status(400).json({ error: 'name は必須です' });
      return;
    }
    await pool.query('UPDATE departments SET name = ? WHERE id = ?', [name, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/departments/:id — 部の削除（所属課あり時はエラー）
router.delete('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as cnt FROM sections WHERE department_id = ?',
      [req.params.id]
    );
    if ((rows[0] as any).cnt > 0) {
      res.status(400).json({ error: 'この部に所属する課が存在します。先に課を削除してください。' });
      return;
    }
    await pool.query('DELETE FROM departments WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/sections — 課の作成
router.post('/sections', async (req, res, next) => {
  try {
    const { department_id, name } = req.body as { department_id: number; name: string };
    if (!department_id || !name) {
      res.status(400).json({ error: 'department_id と name は必須です' });
      return;
    }
    const [result] = await pool.query(
      'INSERT INTO sections (department_id, name) VALUES (?, ?)',
      [department_id, name]
    );
    const id = (result as any).insertId;
    res.status(201).json({ id, department_id, name });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/sections/:id — 課の更新
router.put('/sections/:id', async (req, res, next) => {
  try {
    const { name } = req.body as { name: string };
    if (!name) {
      res.status(400).json({ error: 'name は必須です' });
      return;
    }
    await pool.query('UPDATE sections SET name = ? WHERE id = ?', [name, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/sections/:id — 課の削除（所属メンバーあり時はエラー）
router.delete('/sections/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as cnt FROM members WHERE section_id = ?',
      [req.params.id]
    );
    if ((rows[0] as any).cnt > 0) {
      res.status(400).json({ error: 'この課に所属するメンバーが存在します。先にメンバーの所属を変更してください。' });
      return;
    }
    await pool.query('DELETE FROM sections WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
