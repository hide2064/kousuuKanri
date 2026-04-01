
-- departments
INSERT INTO departments (id, name) VALUES
(1, 'テクノロジー本部'),
(2, 'プロダクト本部'),
(3, 'ビジネス本部');

-- sections
INSERT INTO sections (id, department_id, name) VALUES
(1, 1, 'プラットフォーム開発課'),
(2, 1, 'SRE課'),
(3, 1, 'データ基盤課'),
(4, 2, 'プロダクトマネジメント課'),
(5, 2, 'UI/UXデザイン課'),
(6, 3, '営業企画課'),
(7, 3, 'マーケティング課');
