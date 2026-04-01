import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../db';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

interface ImportError {
  row: number;
  reason: string;
}

// POST /api/v1/import/departments
router.post(
  '/',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      res.status(400).json({ error: 'ファイルが選択されていません' });
      return;
    }

    try {
      const content = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, string>[];

      let imported = 0;
      let skipped  = 0;
      const errors: ImportError[] = [];

      for (let i = 0; i < records.length; i++) {
        const row    = records[i];
        const rowNum = i + 2;
        const deptName = row['department_name'] ?? '';
        const secName  = row['section_name']   ?? '';

        if (!deptName) {
          errors.push({ row: rowNum, reason: 'department_name が空欄です' });
          skipped++;
          continue;
        }

        try {
          // 部を INSERT IGNORE（同名なら既存を使用）
          await pool.query<ResultSetHeader>(
            'INSERT IGNORE INTO departments (name) VALUES (?)',
            [deptName]
          );

          // 部IDを取得
          const [deptRows] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM departments WHERE name = ?',
            [deptName]
          );
          const deptId = deptRows[0].id as number;

          // 課を INSERT IGNORE（同名同部なら既存を使用）
          if (secName) {
            await pool.query<ResultSetHeader>(
              'INSERT IGNORE INTO sections (department_id, name) VALUES (?, ?)',
              [deptId, secName]
            );
          }

          imported++;
        } catch (rowErr) {
          errors.push({ row: rowNum, reason: String(rowErr) });
          skipped++;
        }
      }

      res.json({ total: records.length, imported, skipped, errors });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
