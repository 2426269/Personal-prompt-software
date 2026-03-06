export const IPC_CHANNELS = {
  APP_PING: 'app:ping',

  PARSER_DETECT_TYPE: 'parser:detectType',
  PARSER_PARSE_NAI: 'parser:parseNAI',
  PARSER_PARSE_SD: 'parser:parseSD',
  PARSER_PARSE_COMFYUI: 'parser:parseComfyUI',

  SCRAPER_AITAG_IMPORT: 'scraper:aitag',
  ENTRY_IMPORT_URL: 'entry:import:url',
  ENTRY_IMPORT_TEXT: 'entry:import:text',
  ENTRY_IMPORT_FILE: 'entry:import:file',

  DB_ENTRIES_LIST: 'db:entries:list',
  DB_ENTRIES_GET: 'db:entries:get',
  DB_ENTRIES_UPDATE: 'db:entries:update',
  DB_ENTRIES_DELETE: 'db:entries:delete',

  IMAGE_CACHE_STATUS: 'imageCache:status',
  IMAGE_CACHE_CLEANUP: 'imageCache:cleanup',

  DB_TEMPLATES_LIST: 'db:templates:list',
  DB_TEMPLATES_GET: 'db:templates:get',
  DB_TEMPLATES_SAVE: 'db:templates:save',
  DB_TEMPLATES_DELETE: 'db:templates:delete',

  LLM_ANALYZE: 'llm:analyze',
  LLM_CONFIG_LIST: 'llm:config:list',
  LLM_CONFIG_SAVE: 'llm:config:save',
  LLM_CONFIG_DELETE: 'llm:config:delete',
  LLM_CONFIG_TEST: 'llm:config:test',

  TAG_LIST: 'tag:list',
  TAG_CREATE: 'tag:create',
  TAG_UPDATE: 'tag:update',
  TAG_DELETE: 'tag:delete',
  TAG_ASSIGN: 'tag:assign',
} as const

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
