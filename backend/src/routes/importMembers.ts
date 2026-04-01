import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { RowDataPacket } from 'mysql2';
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

// POST /api/v1/import/members
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
        const row      = records[i];
        const rowNum   = i + 2;
        const code     = row['member_code']     ?? '';
        const name     = row['member_name']     ?? '';
        const unitCost = parseFloat(row['unit_cost'] ?? '0') || 0;
        const deptName = row['department_name'] ?? '';
        const secName  = row['section_name']    ?? '';

        if (!code) {
          errors.push({ row: rowNum, reason: 'member_code が空欄です' });
          skipped++;
          continue;
        }
        if (!name) {
          errors.push({ row: rowNum, reason: 'member_name が空欄です' });
          skipped++;
          continue;
        }

        try {
          // section_id を解決
          let sectionId: number | null = null;

          if (deptName && secName) {
            // 部名 + 課名でDBを検索
            const [secRows] = await pool.query<RowDataPacket[]>(
              `SELECT s.id FROM sections s
               JOIN departments d ON s.department_id = d.id
               WHERE d.name = ? AND s.name = ?`,
              [deptName, secName]
            );
            if (!secRows.length) {
              errors.push({ row: rowNum, reason: `部名または課名が見つかりません: ${deptName} / ${secName}` });
              skipped++;
              continue;
            }
            sectionId = secRows[0].id as number;
          } else if (deptName && !secName) {
            // 部名のみ指定 → 部の存在確認のみ行い section_id は NULL
            const [deptRows] = await pool.query<RowDataPacket[]>(
              'SELECT id FROM departments WHERE name = ?',
              [deptName]
            );
            if (!deptRows.length) {
              errors.push({ row: rowNum, reason: `部名が見つかりません: ${deptName}` });
              skipped++;
              continue;
            }
            sectionId = null;
          }
          // deptName も secName も空の場合は sectionId = null のまま

          // member_code で UPSERT
          await pool.query(
            `INSERT INTO members (code, name, unit_cost, section_id)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               name       = VALUES(name),
               unit_cost  = VALUES(unit_cost),
               section_id = VALUES(section_id)`,
            [code, name, unitCost, sectionId]
          );

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
