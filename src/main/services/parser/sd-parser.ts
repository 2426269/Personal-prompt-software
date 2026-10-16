import type { ParsedSDPrompt, PromptModelReference, SDParameters } from '@shared/types/importer'

import { asObject, extractJsonChunks, safeJsonParse } from './json-utils'
import { enrichReferenceWithMetadata, mergeUniqueModelReferences, parseCivitaiResources, parseHashMap } from './model-metadata'

function asNumber(value: string | undefined): number | null {
  if (!value) {
    return null
  }

  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : null
}

function asInteger(value: string | undefined): number | null {
  const parsed = asNumber(value)
  return parsed === null ? null : Math.trunc(parsed)
}

function parseRawText(input: string | Record<string, unknown>): string {
  if (typeof input === 'string') {
    return input.trim()
  }

  const parameters = input.parameters
  if (typeof parameters === 'string') {
    return parameters.trim()
  }

  return JSON.stringify(input)
}

function splitPromptSections(rawText: string): { prompt: string; negativePrompt: string; paramText: string } {
  const normalized = rawText.replace(/\r\n/g, '\n')
  const negativeMarker = normalized.search(/\n?negative prompt\s*:/i)

  if (negativeMarker < 0) {
    return {
      prompt: normalized,
      negativePrompt: '',
      paramText: '',
    }
  }

  const prompt = normalized.slice(0, negativeMarker).trim()
  const negativeSection = normalized.slice(negativeMarker).replace(/^\n?/u, '')

  const stepsMarker = negativeSection.search(/\n?steps\s*:/i)
  if (stepsMarker < 0) {
    return {
      prompt,
      negativePrompt: negativeSection.replace(/^negative prompt\s*:/i, '').trim(),
      paramText: '',
    }
  }

  const negativePrompt = negativeSection
    .slice(0, stepsMarker)
    .replace(/^negative prompt\s*:/i, '')
    .trim()
  const paramText = negativeSection.slice(stepsMarker).replace(/^\n?/u, '').trim()

  return { prompt, negativePrompt, paramText }
}

function parseParameterText(paramText: string): Record<string, string> {
  if (paramText.length === 0) {
    return {}
  }

  const entries: Record<string, string> = {}
  const normalized = paramText.replace(/\r\n/g, '\n').replace(/\n/g, ', ')
  let cursor = 0

  while (cursor < normalized.length) {
    while (cursor < normalized.length && /[\s,]/.test(normalized[cursor])) {
      cursor += 1
    }

    if (cursor >= normalized.length) {
      break
    }

    const colonIndex = normalized.indexOf(':', cursor)
    if (colonIndex < 0) {
      break
    }

    const key = normalized.slice(cursor, colonIndex).trim()
    if (!key) {
      cursor = colonIndex + 1
      continue
    }

    let index = colonIndex + 1
    let inQuote: '"' | "'" | null = null
    let braceDepth = 0
    let bracketDepth = 0
    let parenDepth = 0

    for (; index < normalized.length; index += 1) {
      const char = normalized[index]
      const previous = index > colonIndex + 1 ? normalized[index - 1] : ''

      if ((char === '"' || char === '\'') && previous !== '\\') {
        if (inQuote === char) {
          inQuote = null
        } else if (inQuote === null) {
          inQuote = char
        }
        continue
      }

      if (inQuote) {
        continue
      }

      if (char === '{') braceDepth += 1
      else if (char === '}') braceDepth = Math.max(0, braceDepth - 1)
      else if (char === '[') bracketDepth += 1
      else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1)
      else if (char === '(') parenDepth += 1
      else if (char === ')') parenDepth = Math.max(0, parenDepth - 1)

      if (char === ',' && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
        const nextSegment = normalized.slice(index + 1)
        if (/^\s*[A-Za-z0-9_\-\s/.]+?\s*:/.test(nextSegment)) {
          break
        }
      }
    }

    const value = normalized.slice(colonIndex + 1, index).trim()
    if (value) {
      entries[key] = value
    }

    cursor = index + 1
  }

  return entries
}

function parseSize(value: string | undefined): { width: number | null; height: number | null } {
  if (!value) {
    return { width: null, height: null }
  }

  const match = value.match(/(\d+)\s*[xX]\s*(\d+)/)
  if (!match) {
    return { width: null, height: null }
  }

  return {
    width: asNumber(match[1]),
    height: asNumber(match[2]),
  }
}

function parseLoras(text: string): PromptModelReference[] {
  const loras: PromptModelReference[] = []
  const regex = /<lora:([^:>]+)(?::([-+]?[0-9]*\.?[0-9]+))?>/gi

  for (const match of text.matchAll(regex)) {
    const name = match[1].trim()
    const weight = asNumber(match[2])
    if (name.length > 0) {
      loras.push(weight === null ? { text: name } : { text: name, weight })
    }
  }

  return loras
}

function attachLoraHashes(
  loras: PromptModelReference[],
  loraHashes: Record<string, string>,
  civitaiResources: ReturnType<typeof parseCivitaiResources>,
): PromptModelReference[] {
  const hashEntries = Object.entries(loraHashes)
  const loraResources = civitaiResources.filter((item) => item.kind === 'lora' || item.kind === 'unknown')
  if (loras.length === 0) {
    return loras
  }

  const enriched = loras.map((lora) => {
    if (lora.hash || lora.modelVersionId != null || lora.modelId != null) {
      return lora
    }

    return lora
  })

  const unresolved = enriched.filter((item) => !item.hash && item.modelVersionId == null && item.modelId == null)
  if (unresolved.length !== 1) {
    return enriched
  }

  const [onlyLora] = unresolved
  const onlyLoraIndex = enriched.findIndex((item) => item === onlyLora)

  if (hashEntries.length === 1 && onlyLoraIndex >= 0) {
    const [, hash] = hashEntries[0]
    const resource = loraResources.length === 1 ? loraResources[0] : null

    enriched[onlyLoraIndex] = {
      ...onlyLora,
      hash,
      modelId: resource?.modelId ?? onlyLora.modelId ?? null,
      modelVersionId: resource?.modelVersionId ?? onlyLora.modelVersionId ?? null,
    }
    return enriched
  }

  if (hashEntries.length === 0 && loraResources.length === 1 && onlyLoraIndex >= 0) {
    const [resource] = loraResources
    enriched[onlyLoraIndex] = {
      ...onlyLora,
      hash: resource.hash ?? onlyLora.hash ?? null,
      modelId: resource.modelId ?? onlyLora.modelId ?? null,
      modelVersionId: resource.modelVersionId ?? onlyLora.modelVersionId ?? null,
    }
    return enriched
  }

  return enriched
}

function parseEmbeddings(text: string): string[] {
  const embeddingRegex = /\bembedding:([\w\-.]+)/gi
  const embeddings = new Set<string>()

  for (const match of text.matchAll(embeddingRegex)) {
    embeddings.add(match[1])
  }

  return [...embeddings]
}

function parseTextFromObject(input: Record<string, unknown>): string {
  if (typeof input.parameters === 'string') {
    return input.parameters
  }

  const chunks = extractJsonChunks(JSON.stringify(input))
  const parametersChunk = chunks
    .map((chunk) => asObject(safeJsonParse(chunk)))
    .find((chunkObject) => typeof chunkObject?.parameters === 'string')

  if (parametersChunk && typeof parametersChunk.parameters === 'string') {
    return parametersChunk.parameters
  }

  return JSON.stringify(input)
}

export class SDParser {
  parse(input: string | Record<string, unknown>): ParsedSDPrompt {
    const rawText = typeof input === 'string' ? parseRawText(input) : parseTextFromObject(input)
    const { prompt, negativePrompt, paramText } = splitPromptSections(rawText)
    const parsedParams = parseParameterText(paramText)
    const size = parseSize(parsedParams.Size)
    const civitaiResources = parseCivitaiResources(parsedParams['Civitai resources'])
    const loraHashes = parseHashMap(parsedParams['Lora hashes'])
    const genericHashes = parseHashMap(parsedParams.Hashes)
    const checkpointName = parsedParams.Model ?? null
    const checkpointHash = parsedParams['Model hash'] ?? genericHashes.model ?? genericHashes.checkpoint ?? null
    const checkpointModelId = asInteger(parsedParams['Model ID'])
    const checkpointModelVersionId = asInteger(parsedParams['Model version ID'])
    const vaeHash = parsedParams['VAE hash'] ?? genericHashes.vae ?? null

    const loras = attachLoraHashes(
      mergeUniqueModelReferences(
        parseLoras(`${prompt}\n${negativePrompt}\n${paramText}`).map((item) => enrichReferenceWithMetadata(item, {
          kind: 'lora',
          hashMap: loraHashes,
          resources: civitaiResources,
        })),
      ),
      loraHashes,
      civitaiResources,
    )

    const checkpoints = checkpointName
      ? [enrichReferenceWithMetadata({ text: checkpointName }, {
          kind: 'checkpoint',
          resources: civitaiResources,
          fallbackHash: checkpointHash,
          fallbackModelId: checkpointModelId,
          fallbackModelVersionId: checkpointModelVersionId,
        })]
      : []

    const parameters: SDParameters = {
      steps: asNumber(parsedParams.Steps),
      sampler: parsedParams.Sampler ?? null,
      cfgScale: asNumber(parsedParams['CFG scale'] ?? parsedParams.CFG),
      seed: asNumber(parsedParams.Seed),
      width: size.width,
      height: size.height,
      model: checkpointName,
      modelHash: checkpointHash,
      modelId: checkpointModelId,
      modelVersionId: checkpointModelVersionId,
      vae: parsedParams.VAE ?? null,
      vaeHash,
      clipSkip: asNumber(parsedParams['Clip skip']),
      denoisingStrength: asNumber(parsedParams['Denoising strength']),
      hiresUpscale: asNumber(parsedParams['Hires upscale']),
      hiresSteps: asNumber(parsedParams['Hires steps']),
      civitaiResources,
      extras: parsedParams,
    }

    return {
      type: 'SD',
      prompt,
      negativePrompt,
      loras,
      checkpoints,
      embeddings: parseEmbeddings(`${prompt}\n${negativePrompt}\n${paramText}`),
      parameters,
      rawText,
    }
  }
}

export function parseSDPrompt(input: string | Record<string, unknown>): ParsedSDPrompt {
  return new SDParser().parse(input)
}
