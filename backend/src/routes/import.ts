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
  data?: Record<string, string>;
}

// POST /api/v1/import/csv
// multipart fields: file (CSV), (type field is read from CSV column "type": "planned"|"actual")
router.post(
  '/csv',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      res.status(400).json({ error: 'ファイルが選択されていません' });
      return;
    }

    try {
      // Strip BOM and parse
      const content = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, string>[];

      let imported = 0;
      let skipped = 0;
      let created = 0;
      const errors: ImportError[] = [];

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNum = i + 2; // 1-indexed + header row

        try {
          // Resolve member by code or name
          const code = row['member_code'] ?? row['メンバーコード'] ?? '';
          const name = row['member_name'] ?? row['メンバー名'] ?? '';

          let memberId: number | null = null;

          if (code) {
            const [r] = await pool.query<RowDataPacket[]>(
              'SELECT id FROM members WHERE code = ? AND active = 1',
              [code]
            );
            if (r.length) memberId = r[0].id as number;
          }

          if (memberId === null && name) {
            const [r] = await pool.query<RowDataPacket[]>(
              'SELECT id FROM members WHERE name = ? AND active = 1',
              [name]
            );
            if (r.length) memberId = r[0].id as number;
          }

          if (memberId === null) {
            // メンバーが存在しない場合は新規登録
            if (!name) {
              errors.push({ row: rowNum, reason: `メンバーが見つかりません（コードと名前の両方が未指定）`, data: row });
              skipped++;
              continue;
            }
            const newCode = code || name;
            const [result] = await pool.query<import('mysql2').ResultSetHeader>(
              'INSERT INTO members (code, name, unit_cost) VALUES (?, ?, 0)',
              [newCode, name]
            );
            memberId = result.insertId;
            created++;
          }

          const year  = parseInt(row['year']  ?? row['年']  ?? row['年度'] ?? '');
          const month = parseInt(row['month'] ?? row['月'] ?? '');
          const type  = (row['type'] ?? row['種別'] ?? '').toLowerCase();
          const hours = parseFloat(row['hours'] ?? row['工数'] ?? row['予定工数'] ?? row['実績工数'] ?? '');

          if (!year || !month || month < 1 || month > 12) {
            errors.push({ row: rowNum, reason: `無効な年月: year=${row['year']??row['年']??row['年度']}, month=${row['month']??row['月']}`, data: row });
            skipped++;
            continue;
          }
          if (isNaN(hours) || hours < 0) {
            errors.push({ row: rowNum, reason: `無効な工数値: ${row['hours']??row['工数']}`, data: row });
            skipped++;
            continue;
          }
          if (type !== 'planned' && type !== 'actual' && type !== '予定' && type !== '実績') {
            errors.push({ row: rowNum, reason: `type は planned/actual/予定/実績 のいずれかを指定: "${type}"`, data: row });
            skipped++;
            continue;
          }

          const isPlanned = type === 'planned' || type === '予定';
          const note = row['note'] ?? row['備考'] ?? null;

          if (isPlanned) {
            await pool.query(
              `INSERT INTO work_hours (member_id, year, month, planned_hours, note)
               VALUES (?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE planned_hours = VALUES(planned_hours), note = COALESCE(VALUES(note), note)`,
              [memberId, year, month, hours, note]
            );
          } else {
            await pool.query(
              `INSERT INTO work_hours (member_id, year, month, actual_hours, note)
               VALUES (?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE actual_hours = VALUES(actual_hours), note = COALESCE(VALUES(note), note)`,
              [memberId, year, month, hours, note]
            );
          }

          imported++;
        } catch (rowErr) {
          errors.push({ row: rowNum, reason: String(rowErr) });
          skipped++;
        }
      }

      res.json({ total: records.length, imported, skipped, created, errors });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
