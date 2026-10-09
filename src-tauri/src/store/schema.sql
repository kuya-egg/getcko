PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS knowledge_bases (id INTEGER PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS documents (id INTEGER PRIMARY KEY, knowledge_base_id INTEGER NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE, file_name TEXT NOT NULL, kind TEXT NOT NULL, page_count INTEGER, status TEXT NOT NULL, error TEXT, fingerprint TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(knowledge_base_id, fingerprint));
CREATE TABLE IF NOT EXISTS passages (id INTEGER PRIMARY KEY, document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE, text TEXT NOT NULL, location TEXT NOT NULL, token_count INTEGER NOT NULL, embedding BLOB NOT NULL);
CREATE TABLE IF NOT EXISTS agents (id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, instructions TEXT NOT NULL, base_rules TEXT NOT NULL, language TEXT NOT NULL, answer_length TEXT NOT NULL, voice_id TEXT, speech_rate REAL NOT NULL, template_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), active_agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS agent_knowledge_bases (agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE, knowledge_base_id INTEGER NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE, PRIMARY KEY(agent_id, knowledge_base_id));
