CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(128) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  description TEXT NOT NULL,
  target_amount BIGINT NOT NULL,
  raised_amount BIGINT NOT NULL DEFAULT 0,
  disbursed_amount BIGINT NOT NULL DEFAULT 0,
  image_url TEXT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  status ENUM('draft', 'active', 'closed') NOT NULL DEFAULT 'draft',
  chain_hash VARCHAR(66) NULL,
  chain_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  chain_tx_hash VARCHAR(66) NULL,
  chain_block_number BIGINT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS donations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT NOT NULL,
  user_id BIGINT NULL,
  donor_name VARCHAR(128) NOT NULL,
  is_anonymous TINYINT(1) NOT NULL DEFAULT 0,
  amount BIGINT NOT NULL,
  message TEXT NULL,
  donated_at DATETIME NOT NULL,
  record_hash VARCHAR(66) NULL,
  chain_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  tx_hash VARCHAR(66) NULL,
  block_number BIGINT NULL,
  chain_recorded_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_donation_project FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT fk_donation_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS disbursements (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT NOT NULL,
  amount BIGINT NOT NULL,
  receiver VARCHAR(128) NOT NULL,
  purpose VARCHAR(128) NOT NULL,
  description TEXT NULL,
  occurred_at DATETIME NOT NULL,
  record_hash VARCHAR(66) NULL,
  chain_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  tx_hash VARCHAR(66) NULL,
  block_number BIGINT NULL,
  chain_recorded_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_disbursement_project FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS chain_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  business_type VARCHAR(32) NOT NULL,
  business_id BIGINT NOT NULL,
  record_hash VARCHAR(66) NOT NULL,
  tx_hash VARCHAR(66) NULL,
  block_number BIGINT NULL,
  status VARCHAR(32) NOT NULL,
  payload_json JSON NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS operation_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  username VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  business_type VARCHAR(32) NOT NULL,
  business_id BIGINT NOT NULL,
  detail_json JSON NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_operation_user FOREIGN KEY (user_id) REFERENCES users(id)
);
