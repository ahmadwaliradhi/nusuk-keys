ALTER TABLE keys ADD COLUMN invalid_at INTEGER;
ALTER TABLE keys ADD COLUMN status_at INTEGER;
CREATE INDEX IF NOT EXISTS keys_status_at ON keys(status_at) WHERE status_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS invalid_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  k TEXT NOT NULL,
  ip TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS invalid_reports_ip_at ON invalid_reports(ip, at);

INSERT OR IGNORE INTO keys (k, src, created_at) VALUES ('NG-r8BBCPN4', 'pinned', 1700000000);
