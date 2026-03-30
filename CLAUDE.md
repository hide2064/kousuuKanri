# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`kousuuKanri` (工数管理) — 作業者ごとの予定・実績工数を管理するWebシステム。
詳細は [`docs/設計書.md`](docs/設計書.md) を参照。

## 起動方法

```bash
# 初回
cp .env.example .env
docker-compose up --build

# 通常
docker-compose up

# データリセット
docker-compose down -v
```

ブラウザ: `http://localhost`

## ローカル開発（Docker不使用）

```bash
# backend (port 3000)
cd backend && npm install && npm run dev

# frontend (port 5173, /api → localhost:3000 にプロキシ)
cd frontend && npm install && npm run dev
```

## アーキテクチャ

```
frontend (React+Vite) → nginx → backend (Express/TS) → MySQL 8
```

- **frontend/src/api/client.ts** — 全APIコール定義（ここを起点にエンドポイント把握）
- **backend/src/routes/reports.ts** — 月次・年次集計の核心ロジック（締日判定含む）
- **backend/src/routes/import.ts** — CSV取込ロジック（UPSERT、エラー収集）
- **db/init/01_schema.sql** — テーブル定義と初期Config値

## API

ベースパス: `/api/v1`

| ルート | ファイル |
|-------|---------|
| /config | backend/src/routes/config.ts |
| /members | backend/src/routes/members.ts |
| /work-hours | backend/src/routes/workHours.ts |
| /reports/monthly, /reports/annual | backend/src/routes/reports.ts |
| /import/csv | backend/src/routes/import.ts |

## 重要な設計ポイント

- `work_hours.planned_hours IS NULL` = 予定工数未登録（締日判定の根拠）
- 赤字表示判定はサーバーサイドで行い、レスポンスに `missingPlanned: boolean` を含める
- 年度（fiscal year）は `config.fiscal_year_start_month` で開始月を制御
- メンバー削除は `active=0` によるソフトデリート
- CSV取込は `member_code` または `member_name` でメンバーを解決、UPSERT で冪等

## Build & Lint

```bash
# backend TypeScript compile check
cd backend && npm run build

# frontend TypeScript + Vite build
cd frontend && npm run build
```
