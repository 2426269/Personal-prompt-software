import type { CivitaiResourceRef, PromptModelReference } from '@shared/types/importer'

function normalizeToken(value: string): string {
  return value.replace(/\\/g, '/').trim().toLowerCase()
}

function normalizeStem(value: string): string {
  const normalized = normalizeToken(value)
  const basename = normalized.split('/').pop() ?? normalized
  return basename.replace(/\.[^/.]+$/, '')
}

function parseInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed)
    }
  }

  return null
}

function parseHashValue(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim().replace(/^0x/i, '')
  return trimmed.length > 0 ? trimmed : null
}

export function parseHashMap(rawValue: string | undefined): Record<string, string> {
  if (!rawValue) {
    return {}
  }

  const trimmed = rawValue.trim()
  if (!trimmed) {
    return {}
  }

  const directJson = safeParseJson(trimmed)
  if (typeof directJson === 'string') {
    return parseHashMap(directJson)
  }

  if (directJson && typeof directJson === 'object' && !Array.isArray(directJson)) {
    return Object.entries(directJson).reduce<Record<string, string>>((acc, [key, value]) => {
      const hash = parseHashValue(value)
      if (hash) {
        acc[normalizeStem(key)] = hash
      }
      return acc
    }, {})
  }

  const normalizedRaw = trimmed
    .replace(/^"(.*)"$/s, '$1')
    .replace(/^'(.*)'$/s, '$1')

  return normalizedRaw.split(',').reduce<Record<string, string>>((acc, segment) => {
    const match = segment.match(/^\s*([^:]+?)\s*:\s*([a-fA-F0-9]{6,})\s*$/)
    if (!match) {
      return acc
    }

    acc[normalizeStem(match[1])] = match[2].toLowerCase()
    return acc
  }, {})
}

export function parseCivitaiResources(rawValue: string | undefined): CivitaiResourceRef[] {
  if (!rawValue) {
    return []
  }

  const parsed = safeParseJson(rawValue.trim())
  if (!parsed) {
    return []
  }

  const items = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { resources?: unknown[] }).resources)
      ? (parsed as { resources: unknown[] }).resources
      : []

  return items.flatMap((item) => {
    if (typeof item !== 'object' || item === null) {
      return []
    }

    const record = item as Record<string, unknown>
    const rawType = typeof record.type === 'string'
      ? record.type
      : typeof record.modelType === 'string'
        ? record.modelType
        : 'unknown'
    const typeValue = rawType.toLowerCase()
    let kind: CivitaiResourceRef['kind'] = 'unknown'
    if (typeValue.includes('lora') || typeValue.includes('lycoris')) {
      kind = 'lora'
    } else if (typeValue.includes('checkpoint')) {
      kind = 'checkpoint'
    } else if (typeValue.includes('vae')) {
      kind = 'vae'
    }

    return [{
      kind,
      name: typeof record.name === 'string' ? record.name : typeof record.modelName === 'string' ? record.modelName : null,
      hash: parseHashValue(record.hash ?? record.sha256 ?? record.modelHash),
      modelId: parseInteger(record.modelId),
      modelVersionId: parseInteger(record.modelVersionId ?? record.versionId),
    }]
  })
}

export function enrichReferenceWithMetadata(
  reference: PromptModelReference,
  options: {
    hashMap?: Record<string, string>
    resources?: CivitaiResourceRef[]
    kind: CivitaiResourceRef['kind']
    fallbackHash?: string | null
    fallbackModelId?: number | null
    fallbackModelVersionId?: number | null
  },
): PromptModelReference {
  const stem = normalizeStem(reference.text)
  const exactHash = options.hashMap?.[stem] ?? options.fallbackHash ?? null
  const resource = options.resources?.find((item) => {
    if (item.kind !== options.kind && item.kind !== 'unknown') {
      return false
    }

    if (item.hash && exactHash && item.hash.toLowerCase() === exactHash.toLowerCase()) {
      return true
    }

    if (item.name && normalizeStem(item.name) === stem) {
      return true
    }

    return false
  })

  return {
    ...reference,
    hash: reference.hash ?? exactHash ?? resource?.hash ?? null,
    modelId: reference.modelId ?? resource?.modelId ?? options.fallbackModelId ?? null,
    modelVersionId: reference.modelVersionId ?? resource?.modelVersionId ?? options.fallbackModelVersionId ?? null,
  }
}

export function mergeUniqueModelReferences<T extends PromptModelReference>(items: T[]): T[] {
  const seen = new Set<string>()
  const result: T[] = []

  for (const item of items) {
    const key = `${normalizeStem(item.text)}:${item.hash ?? ''}:${item.modelVersionId ?? ''}:${item.weight ?? ''}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(item)
  }

  return result
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
