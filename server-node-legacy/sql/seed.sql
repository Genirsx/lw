INSERT INTO users (username, email, password_hash, role, created_at)
SELECT 'admin', 'admin@example.com', '$2a$10$ghl2MAvEZEThS9wp5bIp3eI/JJTXACcwYP0h5.k2iy4OKxRkUHH7C', 'admin', NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@example.com');

INSERT INTO users (username, email, password_hash, role, created_at)
SELECT 'donor', 'donor@example.com', '$2a$10$TwZ8aNXcGl/NFWsHXxSgpe5N0K6qCIoPL6EaXbGxHSyNTyMufEHJ6', 'user', NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'donor@example.com');

INSERT INTO projects (
  name, description, target_amount, raised_amount, disbursed_amount, image_url,
  start_time, end_time, status, chain_status, created_at, updated_at
)
SELECT
  '乡村儿童数字教室计划',
  '为偏远地区学校建设数字教室，补充投影设备、平板终端和网络条件。',
  3000000,
  850000,
  260000,
  'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80',
  NOW(),
  DATE_ADD(NOW(), INTERVAL 30 DAY),
  'active',
  'seeded',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = '乡村儿童数字教室计划');

INSERT INTO projects (
  name, description, target_amount, raised_amount, disbursed_amount, image_url,
  start_time, end_time, status, chain_status, created_at, updated_at
)
SELECT
  '山区母婴健康包公益项目',
  '向山区困难家庭发放基础母婴健康包，并建立阶段性回访记录。',
  1800000,
  420000,
  120000,
  'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80',
  NOW(),
  DATE_ADD(NOW(), INTERVAL 60 DAY),
  'active',
  'seeded',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = '山区母婴健康包公益项目');
