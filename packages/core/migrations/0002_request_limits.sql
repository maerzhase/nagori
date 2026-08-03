CREATE TABLE request_limits (
  key_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  reset_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE login_attempts (
  email_hash TEXT PRIMARY KEY,
  failures INTEGER NOT NULL,
  window_started_at TEXT NOT NULL,
  locked_until TEXT
);
