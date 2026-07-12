-- ================================================================
-- RoadBuddy — MySQL Schema
-- Run this once on your MySQL database before starting the server.
-- Railway runs this automatically via the DB init script.
-- ================================================================

CREATE DATABASE IF NOT EXISTS roadbuddy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE roadbuddy;

CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36)  PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'motorist',
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  phone         VARCHAR(30),
  vehicle_type  VARCHAR(50),
  id_photo_url  TEXT,
  selfie_url    TEXT,
  created_at    BIGINT,
  updated_at    BIGINT,
  INDEX idx_users_email (email),
  INDEX idx_users_role  (role)
);

CREATE TABLE IF NOT EXISTS providers (
  id                VARCHAR(36)  PRIMARY KEY,
  user_id           VARCHAR(36)  NOT NULL,
  business_name     VARCHAR(255) NOT NULL,
  service_type      VARCHAR(50)  NOT NULL,
  business_address  TEXT,
  status            VARCHAR(20)  NOT NULL DEFAULT 'pending',
  subscription_plan VARCHAR(20)  NOT NULL DEFAULT 'trial',
  trial_ends_at     BIGINT,
  lat               DOUBLE,
  lng               DOUBLE,
  avg_rating        DOUBLE       DEFAULT 0,
  review_count      INT          DEFAULT 0,
  created_at        BIGINT,
  INDEX idx_providers_user   (user_id),
  INDEX idx_providers_status (status),
  INDEX idx_providers_type   (service_type)
);

CREATE TABLE IF NOT EXISTS requests (
  id               VARCHAR(36) PRIMARY KEY,
  motorist_id      VARCHAR(36),
  provider_id      VARCHAR(36),
  service_type     VARCHAR(50) NOT NULL,
  description      TEXT,
  location_lat     DOUBLE,
  location_lng     DOUBLE,
  location_address TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at       BIGINT,
  updated_at       BIGINT,
  INDEX idx_requests_motorist (motorist_id),
  INDEX idx_requests_provider (provider_id),
  INDEX idx_requests_status   (status)
);

CREATE TABLE IF NOT EXISTS messages (
  id          VARCHAR(36)  PRIMARY KEY,
  request_id  VARCHAR(36),
  sender_id   VARCHAR(36),
  sender_role VARCHAR(20)  NOT NULL,
  content     TEXT         NOT NULL,
  is_read     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  BIGINT,
  INDEX idx_messages_request (request_id),
  INDEX idx_messages_sender  (sender_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id          VARCHAR(36) PRIMARY KEY,
  request_id  VARCHAR(36),
  motorist_id VARCHAR(36),
  provider_id VARCHAR(36),
  rating      TINYINT     NOT NULL,
  comment     TEXT,
  is_flagged  TINYINT(1)  NOT NULL DEFAULT 0,
  created_at  BIGINT,
  INDEX idx_reviews_provider (provider_id),
  INDEX idx_reviews_motorist (motorist_id)
);

CREATE TABLE IF NOT EXISTS admin_users (
  id         VARCHAR(36) PRIMARY KEY,
  user_id    VARCHAR(36),
  admin_role VARCHAR(20) NOT NULL DEFAULT 'support',
  department VARCHAR(100),
  is_active  TINYINT(1)  NOT NULL DEFAULT 1,
  created_at BIGINT,
  INDEX idx_admin_user (user_id)
);

CREATE TABLE IF NOT EXISTS invite_codes (
  code       VARCHAR(20) PRIMARY KEY,
  role       VARCHAR(20) NOT NULL DEFAULT 'support',
  used_by    VARCHAR(36),
  expires_at BIGINT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         VARCHAR(36) PRIMARY KEY,
  admin_id   VARCHAR(36),
  admin_name VARCHAR(200),
  action     VARCHAR(255) NOT NULL,
  target     TEXT,
  created_at BIGINT,
  INDEX idx_audit_admin (admin_id)
);

CREATE TABLE IF NOT EXISTS settings (
  `key`      VARCHAR(100) PRIMARY KEY,
  value      TEXT         NOT NULL,
  updated_at BIGINT
);
