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