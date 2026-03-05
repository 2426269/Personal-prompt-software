import type { ParsedSDPrompt, SDParameters } from '@shared/types/importer'

import { asObject, extractJsonChunks, safeJsonParse } from './json-utils'

function asNumber(value: string | undefined): number | null {
  if (!value) {
    return null
  }

  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : null
}

function parseRawText(input: string | Record<string, unknown>): string {
  if (typeof input === 'string') {
    return input.trim()
  }

  const parameters = input.parameters
  if (typeof parameters === 'string') {
    return parameters.trim()
  }

  const jsonChunks = JSON.stringify(input)
  return jsonChunks
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
  const normalized = paramText.replace(/\n/g, ', ')
  const regex = /([A-Za-z0-9_\-\s/.]+?)\s*:\s*([^,]+)(?:,|$)/g

  for (const match of normalized.matchAll(regex)) {
    const key = match[1].trim()
    const value = match[2].trim()
    if (key.length > 0) {
      entries[key] = value
    }
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

function parseLoras(text: string): ParsedSDPrompt['loras'] {
  const loras: ParsedSDPrompt['loras'] = []
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

    const parameters: SDParameters = {
      steps: asNumber(parsedParams.Steps),
      sampler: parsedParams.Sampler ?? null,
      cfgScale: asNumber(parsedParams['CFG scale'] ?? parsedParams.CFG),
      seed: asNumber(parsedParams.Seed),
      width: size.width,
      height: size.height,
      model: parsedParams.Model ?? parsedParams['Model hash'] ?? null,
      clipSkip: asNumber(parsedParams['Clip skip']),
      denoisingStrength: asNumber(parsedParams['Denoising strength']),
      hiresUpscale: asNumber(parsedParams['Hires upscale']),
      hiresSteps: asNumber(parsedParams['Hires steps']),
      extras: parsedParams,
    }

    return {
      type: 'SD',
      prompt,
      negativePrompt,
      loras: parseLoras(`${prompt}\n${negativePrompt}\n${paramText}`),
      embeddings: parseEmbeddings(`${prompt}\n${negativePrompt}\n${paramText}`),
      parameters,
      rawText,
    }
  }
}

export function parseSDPrompt(input: string | Record<string, unknown>): ParsedSDPrompt {
  return new SDParser().parse(input)
}


