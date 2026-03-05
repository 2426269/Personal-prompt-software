import type { DetectTypeResult, PromptSourceType } from '@shared/types/importer'

import { asObject, extractJsonChunks, safeJsonParse } from './json-utils'

const SD_MARKERS = ['negative prompt:', 'steps:', 'cfg scale:', 'sampler:']

function isComfyUIPromptObject(value: unknown): boolean {
  const objectValue = asObject(value)
  if (!objectValue) {
    return false
  }

  if (Array.isArray(objectValue.nodes) && Array.isArray(objectValue.links)) {
    return true
  }

  const values = Object.values(objectValue)
  if (values.length === 0) {
    return false
  }

  return values.every((node) => {
    const objectNode = asObject(node)
    if (!objectNode) {
      return false
    }

    return typeof objectNode.class_type === 'string' && asObject(objectNode.inputs) !== null
  })
}

function isNAIObject(value: unknown): boolean {
  const objectValue = asObject(value)
  if (!objectValue) {
    return false
  }

  const keys = new Set(Object.keys(objectValue).map((item) => item.toLowerCase()))
  const hasPromptSignal = keys.has('description') || keys.has('prompt') || keys.has('uc')
  const hasNovelAISignal =
    keys.has('cfg_rescale') || keys.has('sampler') || keys.has('sm') || keys.has('v4_prompt')

  return hasPromptSignal && (hasNovelAISignal || keys.has('comment'))
}

function isSDText(text: string): boolean {
  const lowerText = text.toLowerCase()
  return SD_MARKERS.every((marker) => lowerText.includes(marker))
}

function detectByObject(payload: unknown): DetectTypeResult | null {
  if (isComfyUIPromptObject(payload)) {
    return { type: 'ComfyUI', confidence: 0.98, reasons: ['Detected ComfyUI workflow structure.'] }
  }

  if (isNAIObject(payload)) {
    return { type: 'NAI', confidence: 0.9, reasons: ['Detected NovelAI style fields.'] }
  }

  const objectValue = asObject(payload)
  if (objectValue && typeof objectValue.parameters === 'string') {
    return { type: 'SD', confidence: 0.88, reasons: ['Detected Stable Diffusion parameters text.'] }
  }

  return null
}

function fallbackDetect(text: string): DetectTypeResult {
  if (isSDText(text)) {
    return {
      type: 'SD',
      confidence: 0.82,
      reasons: ['Detected Stable Diffusion text markers.'],
    }
  }

  const normalized = text.toLowerCase()
  if (normalized.includes('cliptextencode') || normalized.includes('ksampler')) {
    return {
      type: 'ComfyUI',
      confidence: 0.72,
      reasons: ['Detected ComfyUI class names in plain text.'],
    }
  }

  if (normalized.includes('cfg_rescale') || normalized.includes('v4_prompt')) {
    return {
      type: 'NAI',
      confidence: 0.7,
      reasons: ['Detected NovelAI specific parameter names in plain text.'],
    }
  }

  return {
    type: 'Unknown',
    confidence: 0.3,
    reasons: ['No deterministic signal found.'],
  }
}

export class PromptTypeDetector {
  detect(input: string | Record<string, unknown>): DetectTypeResult {
    if (typeof input === 'object' && input !== null) {
      return detectByObject(input) ?? {
        type: 'Unknown',
        confidence: 0.35,
        reasons: ['Object format not recognized.'],
      }
    }

    const trimmed = input.trim()
    if (trimmed.length === 0) {
      return {
        type: 'Unknown',
        confidence: 0,
        reasons: ['Input is empty.'],
      }
    }

    const directParsed = safeJsonParse(trimmed)
    const directResult = detectByObject(directParsed)
    if (directResult) {
      return directResult
    }

    const chunks = extractJsonChunks(trimmed)
    for (const chunk of chunks) {
      const parsedChunk = safeJsonParse(chunk)
      const chunkResult = detectByObject(parsedChunk)
      if (chunkResult) {
        return {
          ...chunkResult,
          reasons: [...chunkResult.reasons, 'Detected from a JSON chunk in mixed input.'],
        }
      }
    }

    return fallbackDetect(trimmed)
  }
}

export function detectPromptType(input: string | Record<string, unknown>): PromptSourceType {
  return new PromptTypeDetector().detect(input).type
}
