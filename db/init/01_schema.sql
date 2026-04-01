SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS kousuu_kanri CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kousuu_kanri;

CREATE TABLE IF NOT EXISTS departments (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_department_name (name)
);

CREATE TABLE IF NOT EXISTS sections (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  department_id INT UNSIGNED  NOT NULL,
  name          VARCHAR(100)  NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sections_department_id (department_id),
  UNIQUE KEY uq_section_dept_name (department_id, name),
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS members (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code       VARCHAR(50)   NOT NULL UNIQUE COMMENT 'メンバーコード',
  name       VARCHAR(100)  NOT NULL COMMENT '氏名',
  unit_cost  DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '単価（円/時間）',
  section_id INT UNSIGNED  DEFAULT NULL COMMENT '課ID',
  active     TINYINT(1)    NOT NULL DEFAULT 1 COMMENT '在籍フラグ',
  created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_members_section_id (section_id),
  FOREIGN KEY (section_id) REFERENCES sections(id)
);

CREATE TABLE IF NOT EXISTS work_hours (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id     INT UNSIGNED  NOT NULL,
  year          SMALLINT UNSIGNED NOT NULL COMMENT '年（西暦）',
  month         TINYINT UNSIGNED  NOT NULL COMMENT '月（1-12）',
  planned_hours DECIMAL(6,2)  DEFAULT NULL COMMENT '予定工数（NULL=未登録）',
  actual_hours  DECIMAL(6,2)  DEFAULT NULL COMMENT '実績工数',
  note          VARCHAR(255)  DEFAULT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_member_ym (member_id, year, month),
  INDEX idx_work_hours_ym (year, month),
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS config (
  config_key   VARCHAR(100) NOT NULL PRIMARY KEY,
  config_value VARCHAR(255) NOT NULL,
  description  VARCHAR(255) DEFAULT NULL,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO config (config_key, config_value, description) VALUES
  ('planned_hours_deadline_day', '10',       '予定工数の締日（日）'),
  ('fiscal_year_start_month',   '4',         '年度開始月（1=1月, 4=4月）'),
  ('currency',                  'JPY',       '通貨'),
  ('company_name',              '工数管理システム', 'システム名称')
ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);

-- サンプルデータ
INSERT IGNORE INTO members (code, name, unit_cost) VALUES
  ('M001', '田中太郎', 5000),
  ('M002', '山田花子', 5500),
  ('M003', '佐藤次郎', 4800);
