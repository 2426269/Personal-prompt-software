import type { ParsedNAIPrompt } from '@shared/types/importer'

import { asObject, extractJsonChunks, safeJsonParse } from './json-utils'

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') {
    return value
  }

  return null
}

function resolveRootObject(input: string | Record<string, unknown>): Record<string, unknown> {
  if (typeof input === 'object' && input !== null) {
    return input
  }

  const directParsed = safeJsonParse(input)
  const directObject = asObject(directParsed)
  if (directObject) {
    return directObject
  }

  const chunk = extractJsonChunks(input)
    .map((item) => asObject(safeJsonParse(item)))
    .find((item): item is Record<string, unknown> => item !== null)

  if (chunk) {
    return chunk
  }

  return {}
}

function resolveCommentObject(root: Record<string, unknown>): Record<string, unknown> {
  const comment = root.Comment
  if (typeof comment === 'string') {
    const parsedComment = asObject(safeJsonParse(comment))
    if (parsedComment) {
      return parsedComment
    }
  }

  if (asObject(comment)) {
    return comment as Record<string, unknown>
  }

  return {}
}

function resolvePrompt(root: Record<string, unknown>, comment: Record<string, unknown>): string {
  return (
    asString(root.prompt) ??
    asString(root.Prompt) ??
    asString(root.Description) ??
    asString(comment.prompt) ??
    ''
  )
}

function resolveNegativePrompt(root: Record<string, unknown>, comment: Record<string, unknown>): string {
  return (
    asString(root.uc) ??
    asString(root.negative_prompt) ??
    asString(comment.uc) ??
    asString(comment.negative_prompt) ??
    ''
  )
}

export class NAIParser {
  parse(input: string | Record<string, unknown>): ParsedNAIPrompt {
    const root = resolveRootObject(input)
    const comment = resolveCommentObject(root)

    const steps = asNumber(comment.steps) ?? asNumber(root.steps)
    const sampler = asString(comment.sampler) ?? asString(root.sampler)
    const scale = asNumber(comment.scale) ?? asNumber(root.scale) ?? asNumber(comment.cfg)
    const seed = asNumber(comment.seed) ?? asNumber(root.seed)
    const width = asNumber(comment.width) ?? asNumber(root.width)
    const height = asNumber(comment.height) ?? asNumber(root.height)
    const model =
      asString(comment.model) ??
      asString(comment.model_name) ??
      asString(root.model) ??
      asString(root.model_name)

    return {
      type: 'NAI',
      prompt: resolvePrompt(root, comment),
      negativePrompt: resolveNegativePrompt(root, comment),
      steps,
      sampler,
      scale,
      seed,
      width,
      height,
      model,
      raw: {
        ...root,
        _comment: comment,
      },
    }
  }
}

export function parseNAIPrompt(input: string | Record<string, unknown>): ParsedNAIPrompt {
  return new NAIParser().parse(input)
}
