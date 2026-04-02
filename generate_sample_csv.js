#!/usr/bin/env node
/**
 * サンプルCSVファイル生成スクリプト
 * 生成対象:
 *   - work_hours.csv  (複合フォーマット: member_code,year,month,planned_hours,actual_hours,note / 2023-2025年 3年分)
 *
 * members.csv / departments_sections.csv は既存のものをそのまま使用
 */

const fs = require('fs');
const path = require('path');

// ─── members.csv を読み込み（インポート形式） ──────────────────────────────
// 形式: member_code,member_name,unit_cost,department_name,section_name
const rawMembers = fs.readFileSync(path.join(__dirname, 'members.csv'), 'utf8');
const rawLines = rawMembers.trim().split('\n').slice(1); // ヘッダー除去

// 非アクティブメンバー（元データで active=0 だったコード）
const INACTIVE = new Set(['M035', 'M066', 'M099', 'M132', 'M171']);

const members = rawLines
  .map(line => {
    const parts = line.split(',').map(s => s.trim());
    return { code: parts[0], name: parts[1] };
  })
  .filter(m => m.code && !INACTIVE.has(m.code));

console.log(`members.csv: ${members.length} 件（アクティブのみ）`);

// ─── work_hours.csv を生成 ─────────────────────────────────────────────────
const activeMembers = members;

// 決定論的な擬似乱数 (xorshift32)
let _seed = 0xDEADBEEF;
function rand() {
  _seed ^= _seed << 13;
  _seed ^= _seed >>> 17;
  _seed ^= _seed << 5;
  return ((_seed >>> 0) / 0xFFFFFFFF);
}
function randInt(min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}

const NOTES = [
  'プロジェクトA対応', 'プロジェクトB対応', '要件定義作業', '基本設計',
  '詳細設計', '開発作業', 'テスト作業', 'リリース対応', '障害対応',
  'コードレビュー', '顧客打合せ', 'ドキュメント作成', '社内会議',
  '勉強会・研修', '引継ぎ作業',
  '', '', '', '', '', '', '', '', '', '', // 空白が多め
];

// 複合フォーマット: 1行に予定・実績を同時に持つ
const wRows = ['member_code,year,month,planned_hours,actual_hours,note'];

for (let year = 2023; year <= 2025; year++) {
  for (let month = 1; month <= 12; month++) {
    for (const m of activeMembers) {
      // 月の稼働日数ベース（2月は少なめ、長月は多め）
      const workDaysBase = (month === 2) ? 18
        : ([1, 3, 5, 7, 8, 10, 12].includes(month)) ? 22
        : 21;
      const baseHours = workDaysBase * 8;

      // 予定工数: ±10%の範囲で変動
      const plannedVariance = randInt(-(baseHours * 0.08 | 0), baseHours * 0.12 | 0);
      const plannedHours = Math.max(100, baseHours + plannedVariance);

      // 実績工数: 予定 ±12% 程度
      const actualVariance = randInt(-(plannedHours * 0.10 | 0), plannedHours * 0.14 | 0);
      const actualHours = Math.max(80, plannedHours + actualVariance);

      // 3%の確率で予定工数なし、3%の確率で実績工数なし
      const plannedStr = rand() < 0.03 ? '' : String(plannedHours);
      const actualStr  = rand() < 0.03 ? '' : (actualHours % 1 === 0 ? String(actualHours) : actualHours.toFixed(1));

      // メモ: 15%の確率で付与
      const noteIdx = randInt(0, NOTES.length - 1);
      const note = rand() < 0.15 ? NOTES[noteIdx] : '';

      wRows.push(`${m.code},${year},${month},${plannedStr},${actualStr},${note}`);
    }
  }
}

fs.writeFileSync(path.join(__dirname, 'work_hours.csv'), wRows.join('\n') + '\n', 'utf8');
const totalRows = wRows.length - 1;
console.log(`work_hours.csv: ${totalRows} 件 (${Math.round(totalRows / 36)} 件/月)`);
console.log('完了');
