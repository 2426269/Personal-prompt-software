export const IPC_CHANNELS = {
  APP_PING: 'app:ping',

  PARSER_DETECT_TYPE: 'parser:detectType',
  PARSER_PARSE_NAI: 'parser:parseNAI',
  PARSER_PARSE_SD: 'parser:parseSD',
  PARSER_PARSE_COMFYUI: 'parser:parseComfyUI',

  SCRAPER_AITAG_IMPORT: 'scraper:aitag',
  ENTRY_IMPORT_URL: 'entry:import:url',
} as const

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
