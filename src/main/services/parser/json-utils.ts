export function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export function extractJsonChunks(text: string): string[] {
  const chunks: string[] = []
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }

      if (char === '\\') {
        escaped = true
        continue
      }

      if (char === '"') {
        inString = false
      }

      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{' || char === '[') {
      if (depth === 0) {
        start = index
      }
      depth += 1
      continue
    }

    if (char === '}' || char === ']') {
      depth -= 1
      if (depth === 0 && start >= 0) {
        const segment = text.slice(start, index + 1).trim()
        if (segment.length > 0) {
          chunks.push(segment)
        }
        start = -1
      }
    }
  }

  return chunks
}

export function asObject(input: unknown): Record<string, unknown> | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return null
  }

  return input as Record<string, unknown>
}

