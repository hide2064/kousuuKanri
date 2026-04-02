import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../db';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

interface ImportError {
  row: number;
  reason: string;
  data?: Record<string, string>;
}

/** type/hours 形式（別行）のバッチ用 */
interface SplitRow {
  memberId: number;
  year: number;
  month: number;
  hours: number;
  note: string | null;
}

/** planned_hours/actual_hours 形式（同一行）のバッチ用 */
interface CombinedRow {
  memberId: number;
  year: number;
  month: number;
  plannedHours: number | null;
  actualHours: number | null;
  note: string | null;
}

const BATCH = 500;

/** planned または actual を個別列でバッチINSERT */
async function batchInsertSplit(
  rows: SplitRow[],
  column: 'planned_hours' | 'actual_hours'
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const ph = batch.map(() => '(?,?,?,?,?)').join(',');
    const vals = batch.flatMap(r => [r.memberId, r.year, r.month, r.hours, r.note]);
    await pool.query(
      `INSERT INTO work_hours (member_id, year, month, ${column}, note)
       VALUES ${ph}
       ON DUPLICATE KEY UPDATE
         ${column} = VALUES(${column}),
         note = COALESCE(VALUES(note), note)`,
      vals
    );
  }
}

/** planned_hours + actual_hours を同一行でバッチINSERT */
async function batchInsertCombined(rows: CombinedRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const ph = batch.map(() => '(?,?,?,?,?,?)').join(',');
    const vals = batch.flatMap(r => [r.memberId, r.year, r.month, r.plannedHours, r.actualHours, r.note]);
    await pool.query(
      `INSERT INTO work_hours (member_id, year, month, planned_hours, actual_hours, note)
       VALUES ${ph}
       ON DUPLICATE KEY UPDATE
         planned_hours = COALESCE(VALUES(planned_hours), planned_hours),
         actual_hours  = COALESCE(VALUES(actual_hours),  actual_hours),
         note = COALESCE(VALUES(note), note)`,
      vals
    );
  }
}

// POST /api/v1/import/csv
router.post(
  '/csv',
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

      // ── 1. メンバーを一括取得して Map に保持 ──
      const [memberRows] = await pool.query<RowDataPacket[]>(
        'SELECT id, code, name FROM members WHERE active = 1'
      );
      const codeMap = new Map<string, number>();
      const nameMap = new Map<string, number>();
      for (const m of memberRows) {
        codeMap.set(m.code as string, m.id as number);
        nameMap.set(m.name as string, m.id as number);
      }

      // ── 2. 全行を検証してバッチリストに振り分け ──
      const plannedRows:  SplitRow[]    = [];
      const actualRows:   SplitRow[]    = [];
      const combinedRows: CombinedRow[] = [];
      let skipped = 0;
      let created = 0;
      const errors: ImportError[] = [];

      for (let i = 0; i < records.length; i++) {
        const row    = records[i];
        const rowNum = i + 2;

        // ── メンバー解決 ──
        const code = row['member_code'] ?? row['メンバーコード'] ?? '';
        const name = row['member_name'] ?? row['メンバー名']     ?? '';
        let memberId = codeMap.get(code) ?? nameMap.get(name) ?? null;

        if (memberId === null) {
          if (!name) {
            errors.push({ row: rowNum, reason: 'メンバーが見つかりません（コードと名前の両方が未指定）', data: row });
            skipped++;
            continue;
          }
          const newCode = code || name;
          const [result] = await pool.query<ResultSetHeader>(
            'INSERT IGNORE INTO members (code, name, unit_cost) VALUES (?, ?, 0)',
            [newCode, name]
          );
          if (result.insertId > 0) {
            codeMap.set(newCode, result.insertId);
            nameMap.set(name,    result.insertId);
            memberId = result.insertId;
            created++;
          } else {
            const [r] = await pool.query<RowDataPacket[]>(
              'SELECT id FROM members WHERE code = ?', [newCode]
            );
            if (r.length) {
              memberId = r[0].id as number;
              codeMap.set(newCode, memberId);
            } else {
              errors.push({ row: rowNum, reason: 'メンバーの作成に失敗しました', data: row });
              skipped++;
              continue;
            }
          }
        }

        // ── 年月チェック ──
        const year  = parseInt(row['year']  ?? row['年']   ?? row['年度'] ?? '');
        const month = parseInt(row['month'] ?? row['月']   ?? '');
        if (!year || !month || month < 1 || month > 12) {
          errors.push({ row: rowNum, reason: `無効な年月: year=${row['year']}, month=${row['month']}`, data: row });
          skipped++;
          continue;
        }

        const note = (row['note'] ?? row['備考'] ?? '') || null;

        // ── フォーマット判定 ──
        // planned_hours / actual_hours 列があれば「複合フォーマット」
        const hasCombinedColumns =
          'planned_hours' in row || 'actual_hours' in row ||
          '予定工数' in row      || '実績工数' in row;

        if (hasCombinedColumns) {
          // 複合フォーマット: 1行に予定・実績を同時に持つ
          const pRaw = row['planned_hours'] ?? row['予定工数'] ?? '';
          const aRaw = row['actual_hours']  ?? row['実績工数'] ?? '';
          const plannedHours = pRaw !== '' ? parseFloat(pRaw) : null;
          const actualHours  = aRaw !== '' ? parseFloat(aRaw) : null;

          if (plannedHours !== null && (isNaN(plannedHours) || plannedHours < 0)) {
            errors.push({ row: rowNum, reason: `無効な予定工数: ${pRaw}`, data: row });
            skipped++;
            continue;
          }
          if (actualHours !== null && (isNaN(actualHours) || actualHours < 0)) {
            errors.push({ row: rowNum, reason: `無効な実績工数: ${aRaw}`, data: row });
            skipped++;
            continue;
          }
          if (plannedHours === null && actualHours === null) {
            skipped++;
            continue;
          }
          combinedRows.push({ memberId: memberId!, year, month, plannedHours, actualHours, note });

        } else {
          // 分割フォーマット: type 列で planned / actual を区別
          const type  = (row['type'] ?? row['種別'] ?? '').toLowerCase();
          const hours = parseFloat(row['hours'] ?? row['工数'] ?? '');

          if (isNaN(hours) || hours < 0) {
            errors.push({ row: rowNum, reason: `無効な工数値: ${row['hours']}`, data: row });
            skipped++;
            continue;
          }
          if (!['planned', 'actual', '予定', '実績'].includes(type)) {
            errors.push({ row: rowNum, reason: `type は planned/actual/予定/実績 のいずれかを指定: "${type}"`, data: row });
            skipped++;
            continue;
          }

          const splitRow: SplitRow = { memberId: memberId!, year, month, hours, note };
          if (type === 'planned' || type === '予定') plannedRows.push(splitRow);
          else                                        actualRows.push(splitRow);
        }
      }

      // ── 3. バッチINSERT ──
      await batchInsertCombined(combinedRows);
      await batchInsertSplit(plannedRows, 'planned_hours');
      await batchInsertSplit(actualRows,  'actual_hours');

      const imported = combinedRows.length + plannedRows.length + actualRows.length;
      res.json({ total: records.length, imported, skipped, created, errors });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
