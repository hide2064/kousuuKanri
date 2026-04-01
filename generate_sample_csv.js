#!/usr/bin/env node
/**
 * サンプルCSVファイル生成スクリプト
 * 生成対象:
 *   - members.csv         (インポート形式: member_code,member_name,unit_cost,department_name,section_name)
 *   - work_hours.csv      (インポート形式: member_code,year,month,type,hours,note / 2023-2025年 3年分)
 *
 * departments_sections.csv は既存のものをそのまま使用
 */

const fs = require('fs');
const path = require('path');

// ─── セクションIDから部・課名へのマッピング ───────────────────────────────
const SECTION_MAP = {
  '1': { dept: 'テクノロジー本部', section: 'プラットフォーム開発課' },
  '2': { dept: 'テクノロジー本部', section: 'SRE課' },
  '3': { dept: 'テクノロジー本部', section: 'データ基盤課' },
  '4': { dept: 'プロダクト本部',   section: 'プロダクトマネジメント課' },
  '5': { dept: 'プロダクト本部',   section: 'UI/UXデザイン課' },
  '6': { dept: 'ビジネス本部',     section: '営業企画課' },
  '7': { dept: 'ビジネス本部',     section: 'マーケティング課' },
};

// ─── 既存 members.csv を読み込み ──────────────────────────────────────────
// 形式: code,name,unit_cost,section_id,active
const rawMembers = fs.readFileSync(path.join(__dirname, 'members.csv'), 'utf8');
const rawLines = rawMembers.trim().split('\n').slice(1); // ヘッダー除去

const members = rawLines
  .map(line => {
    const [code, name, unit_cost, section_id, active] = line.split(',').map(s => s.trim());
    return { code, name, unit_cost, section_id, active };
  })
  .filter(m => m.code);

// ─── members.csv を書き出し（インポート形式） ──────────────────────────────
{
  const rows = ['member_code,member_name,unit_cost,department_name,section_name'];
  for (const m of members) {
    const map = SECTION_MAP[m.section_id] || { dept: '', section: '' };
    rows.push(`${m.code},${m.name},${m.unit_cost},${map.dept},${map.section}`);
  }
  fs.writeFileSync(path.join(__dirname, 'members.csv'), rows.join('\n') + '\n', 'utf8');
  console.log(`members.csv: ${rows.length - 1} 件`);
}

// ─── work_hours.csv を生成 ─────────────────────────────────────────────────
// アクティブメンバーのみ工数データを生成
const activeMembers = members.filter(m => m.active === '1');

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

const wRows = ['member_code,year,month,type,hours,note'];

for (let year = 2023; year <= 2025; year++) {
  for (let month = 1; month <= 12; month++) {
    for (const m of activeMembers) {
      // 月の稼働日数ベース（2月は少なめ、長月は多め）
      const workDaysBase = (month === 2) ? 18
        : ([1, 3, 5, 7, 8, 10, 12].includes(month)) ? 22
        : 21;
      const baseHours = workDaysBase * 8;

      // 予定工数: ±10%の範囲で変動
      const plannedVariance = randInt(-baseHours * 0.08 | 0, baseHours * 0.12 | 0);
      const plannedHours = Math.max(100, baseHours + plannedVariance);

      // 実績工数: 予定 ±12% 程度
      const actualVariance = randInt(-plannedHours * 0.10 | 0, plannedHours * 0.14 | 0);
      const actualHours = Math.max(80, plannedHours + actualVariance);

      // 3%の確率で予定工数なし（締日前など）
      const missingPlanned = rand() < 0.03;
      // 3%の確率で実績工数なし
      const missingActual = rand() < 0.03;

      // メモ: 20%の確率で付与
      const noteIdx = randInt(0, NOTES.length - 1);
      const note = rand() < 0.20 ? NOTES[noteIdx] : '';

      if (!missingPlanned) {
        wRows.push(`${m.code},${year},${month},planned,${plannedHours},`);
      }
      if (!missingActual) {
        const actualStr = (actualHours % 1 === 0)
          ? actualHours.toString()
          : actualHours.toFixed(1);
        wRows.push(`${m.code},${year},${month},actual,${actualStr},${note}`);
      }
    }
  }
}

fs.writeFileSync(path.join(__dirname, 'work_hours.csv'), wRows.join('\n') + '\n', 'utf8');
const totalRows = wRows.length - 1;
const monthCount = 36;
console.log(`work_hours.csv: ${totalRows} 件 (平均 ${Math.round(totalRows / monthCount)} 件/月)`);
console.log('完了');
