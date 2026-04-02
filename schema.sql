-- D1 Database Schema for Gist Analytics

CREATE TABLE IF NOT EXISTS gist_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gist_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    first_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    view_count INTEGER DEFAULT 1,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    UNIQUE(gist_id, filename)
);

CREATE INDEX idx_gist_analytics_gist_id ON gist_analytics(gist_id);
CREATE INDEX idx_gist_analytics_last_accessed ON gist_analytics(last_accessed_at DESC);
CREATE INDEX idx_gist_analytics_view_count ON gist_analytics(view_count DESC);
CREATE INDEX idx_gist_analytics_first_accessed ON gist_analytics(first_accessed_at DESC);

-- Stored Gists for Shareable Links
CREATE TABLE IF NOT EXISTS stored_gists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    share_id TEXT UNIQUE NOT NULL,  -- short shareable ID like "abc123"
    original_gist_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    content TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0
);

CREATE INDEX idx_stored_gists_share_id ON stored_gists(share_id);
CREATE INDEX idx_stored_gists_original_gist_id ON stored_gists(original_gist_id);

-- Abuse Reports
CREATE TABLE IF NOT EXISTS abuse_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gist_id TEXT NOT NULL,
    share_id TEXT,
    reporter_ip TEXT NOT NULL,
    reason TEXT NOT NULL,
    reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending'
);

CREATE INDEX idx_abuse_reports_gist_id ON abuse_reports(gist_id);
CREATE INDEX idx_abuse_reports_status ON abuse_reports(status);

-- Direct uploads
ALTER TABLE stored_gists ADD COLUMN source TEXT DEFAULT 'gist';
ALTER TABLE stored_gists ADD COLUMN uploaded_by TEXT;

-- Full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS component_search USING fts5(
    share_id,
    filename,
    description,
    content='stored_gists',
    content_rowid='id'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS stored_gists_ai AFTER INSERT ON stored_gists BEGIN
    INSERT INTO component_search(rowid, share_id, filename, description)
    VALUES (new.id, new.share_id, new.filename, new.description);
END;

CREATE TRIGGER IF NOT EXISTS stored_gists_ad AFTER DELETE ON stored_gists BEGIN
    INSERT INTO component_search(component_search, rowid, share_id, filename, description)
    VALUES ('delete', old.id, old.share_id, old.filename, old.description);
END;

CREATE TRIGGER IF NOT EXISTS stored_gists_au AFTER UPDATE ON stored_gists BEGIN
    INSERT INTO component_search(component_search, rowid, share_id, filename, description)
    VALUES ('delete', old.id, old.share_id, old.filename, old.description);
    INSERT INTO component_search(rowid, share_id, filename, description)
    VALUES (new.id, new.share_id, new.filename, new.description);
END;

-- Rate Limiting
CREATE TABLE IF NOT EXISTS rate_limits (
    ip TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    window_start INTEGER NOT NULL,
    request_count INTEGER DEFAULT 1,
    PRIMARY KEY (ip, endpoint, window_start)
);