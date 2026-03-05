import type { Database } from 'better-sqlite3'

export interface Migration {
  id: string
  up: (db: Database) => void
}

export const initialSchemaMigration: Migration = {
  id: '001_initial_schema',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        pixiv_id TEXT,
        author_id TEXT,
        author_name TEXT,
        title TEXT NOT NULL,
        custom_name TEXT,
        caption TEXT,
        type TEXT NOT NULL CHECK (type IN ('NAI', 'SD', 'ComfyUI')),
        tags TEXT,
        source_url TEXT,
        source_site TEXT NOT NULL DEFAULT 'aitag.win',
        post_date TEXT,
        views INTEGER NOT NULL DEFAULT 0,
        bookmarks INTEGER NOT NULL DEFAULT 0,
        raw_json TEXT NOT NULL,
        is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
        is_favorited INTEGER NOT NULL DEFAULT 0 CHECK (is_favorited IN (0, 1)),
        favorite_note TEXT,
        favorite_rating INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        image_index INTEGER NOT NULL,
        original_url TEXT,
        local_path TEXT,
        ai_json TEXT,
        prompt_text TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
        UNIQUE (entry_id, image_index)
      );

      CREATE TABLE IF NOT EXISTS analyzed_templates (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        template_json TEXT NOT NULL,
        removed_specific TEXT,
        settings_common TEXT,
        custom_categories TEXT,
        ai_model_used TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS favorites (
        entry_id TEXT PRIMARY KEY,
        note TEXT,
        rating INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS user_tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#1f6feb',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS entry_tags (
        entry_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (entry_id, tag_id),
        FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES user_tags(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tags TEXT,
        notes TEXT,
        original_json TEXT NOT NULL,
        clean_json TEXT,
        api_prompt_json TEXT,
        slot_map_json TEXT,
        derived_from_entry_id TEXT,
        is_default_test INTEGER NOT NULL DEFAULT 0 CHECK (is_default_test IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (derived_from_entry_id) REFERENCES entries(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS entry_workflow_binding (
        entry_id TEXT PRIMARY KEY,
        original_workflow_id TEXT,
        clean_workflow_id TEXT,
        preferred_test_workflow_id TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
        FOREIGN KEY (original_workflow_id) REFERENCES workflows(id) ON DELETE SET NULL,
        FOREIGN KEY (clean_workflow_id) REFERENCES workflows(id) ON DELETE SET NULL,
        FOREIGN KEY (preferred_test_workflow_id) REFERENCES workflows(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS remote_profiles (
        id TEXT PRIMARY KEY,
        comfy_base_url TEXT NOT NULL,
        comfy_history_route TEXT NOT NULL DEFAULT '/history',
        ssh_host TEXT,
        ssh_port INTEGER NOT NULL DEFAULT 22,
        ssh_user TEXT,
        ssh_password_encrypted BLOB,
        comfy_root_path TEXT,
        loras_paths TEXT NOT NULL DEFAULT '["models/loras","models/lycoris"]',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS remote_lora_index (
        profile_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        path TEXT NOT NULL,
        file_size INTEGER,
        last_synced_at TEXT,
        civitai_url TEXT,
        civitai_name TEXT,
        PRIMARY KEY (profile_id, path, filename),
        FOREIGN KEY (profile_id) REFERENCES remote_profiles(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ai_model_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT NOT NULL CHECK (provider IN ('openai', 'deepseek', 'qwen', 'glm', 'ollama')),
        endpoint TEXT NOT NULL,
        api_key_encrypted BLOB,
        model_name TEXT NOT NULL,
        temperature REAL NOT NULL DEFAULT 0.3,
        is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type);
      CREATE INDEX IF NOT EXISTS idx_entries_author_id ON entries(author_id);
      CREATE INDEX IF NOT EXISTS idx_entries_pixiv_id ON entries(pixiv_id);
      CREATE INDEX IF NOT EXISTS idx_images_entry_id ON images(entry_id);
      CREATE INDEX IF NOT EXISTS idx_workflows_entry_id ON workflows(derived_from_entry_id);
      CREATE INDEX IF NOT EXISTS idx_remote_lora_profile ON remote_lora_index(profile_id);
    `)
  },
}
