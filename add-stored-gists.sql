-- Add stored_gists table for shareable links
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

CREATE INDEX IF NOT EXISTS idx_stored_gists_share_id ON stored_gists(share_id);
CREATE INDEX IF NOT EXISTS idx_stored_gists_original_gist_id ON stored_gists(original_gist_id);