import type { ComfySamplerNode, ParsedComfyUIPrompt, PromptTag } from '@shared/types/importer'

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

function asNodeId(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }

  return ''
}

function isComfyApiObject(payload: Record<string, unknown>): boolean {
  const values = Object.values(payload)
  if (values.length === 0) {
    return false
  }

  return values.every((node) => {
    const objectNode = asObject(node)
    return !!objectNode && typeof objectNode.class_type === 'string' && asObject(objectNode.inputs) !== null
  })
}

function isComfyUIWorkflow(payload: Record<string, unknown>): boolean {
  return Array.isArray(payload.nodes) && Array.isArray(payload.links)
}

function resolveComfyPayload(
  input: string | Record<string, unknown>,
): { format: ParsedComfyUIPrompt['format']; payload: Record<string, unknown> } {
  const candidates: Record<string, unknown>[] = []

  if (typeof input === 'object' && input !== null) {
    candidates.push(input)
  } else {
    const direct = asObject(safeJsonParse(input))
    if (direct) {
      candidates.push(direct)
    }

    for (const chunk of extractJsonChunks(input)) {
      const parsedChunk = asObject(safeJsonParse(chunk))
      if (parsedChunk) {
        candidates.push(parsedChunk)
      }
    }
  }

  for (const candidate of candidates) {
    if (isComfyApiObject(candidate)) {
      return { format: 'api_prompt', payload: candidate }
    }

    if (isComfyUIWorkflow(candidate)) {
      return { format: 'ui_workflow', payload: candidate }
    }
  }

  return { format: 'api_prompt', payload: {} }
}

function pushUnique(list: string[], value: string | null): void {
  if (!value) {
    return
  }

  if (!list.includes(value)) {
    list.push(value)
  }
}

function pushUniqueLora(list: PromptTag[], loraName: string | null, weight: number | null): void {
  if (!loraName) {
    return
  }

  const exists = list.find((item) => item.text === loraName)
  if (exists) {
    return
  }

  list.push(weight === null ? { text: loraName } : { text: loraName, weight })
}

function classifyPromptTarget(nodeId: string, classType: string, title: string | null): 'positive' | 'negative' {
  const fingerprint = `${nodeId} ${classType} ${title ?? ''}`.toLowerCase()
  return fingerprint.includes('negative') || fingerprint.includes('neg') ? 'negative' : 'positive'
}

function parseSamplerFromInputs(nodeId: string, inputs: Record<string, unknown>): ComfySamplerNode {
  return {
    nodeId,
    steps: asNumber(inputs.steps),
    cfg: asNumber(inputs.cfg),
    sampler: asString(inputs.sampler_name) ?? asString(inputs.sampler),
    scheduler: asString(inputs.scheduler),
    seed: asNumber(inputs.seed),
    denoise: asNumber(inputs.denoise),
  }
}

function parseApiPrompt(payload: Record<string, unknown>): ParsedComfyUIPrompt {
  const positive: string[] = []
  const negative: string[] = []
  const checkpoints: string[] = []
  const loras: PromptTag[] = []
  const samplers: ComfySamplerNode[] = []
  let width: number | null = null
  let height: number | null = null

  for (const [nodeId, rawNode] of Object.entries(payload)) {
    const node = asObject(rawNode)
    if (!node) {
      continue
    }

    const classType = asString(node.class_type)
    const inputs = asObject(node.inputs)
    if (!classType || !inputs) {
      continue
    }

    if (classType === 'CLIPTextEncode') {
      const text = asString(inputs.text)
      const title = asString(asObject(node._meta)?.title)
      const target = classifyPromptTarget(nodeId, classType, title)
      if (target === 'negative') {
        pushUnique(negative, text)
      } else {
        pushUnique(positive, text)
      }
      continue
    }

    if (classType === 'KSampler') {
      samplers.push(parseSamplerFromInputs(nodeId, inputs))
      continue
    }

    if (classType.includes('CheckpointLoader')) {
      pushUnique(checkpoints, asString(inputs.ckpt_name))
      continue
    }

    if (classType.includes('LoraLoader') || classType.includes('LycorisLoader')) {
      pushUniqueLora(
        loras,
        asString(inputs.lora_name) ?? asString(inputs.lycoris_name),
        asNumber(inputs.strength_model),
      )
      continue
    }

    if (classType === 'EmptyLatentImage') {
      width = width ?? asNumber(inputs.width)
      height = height ?? asNumber(inputs.height)
    }
  }

  return {
    type: 'ComfyUI',
    format: 'api_prompt',
    nodeCount: Object.keys(payload).length,
    prompts: {
      positive,
      negative,
    },
    checkpoints,
    loras,
    samplers,
    size: { width, height },
    raw: payload,
  }
}

function getWidgets(node: Record<string, unknown>): unknown[] {
  return Array.isArray(node.widgets_values) ? node.widgets_values : []
}

function parseUiWorkflow(payload: Record<string, unknown>): ParsedComfyUIPrompt {
  const positive: string[] = []
  const negative: string[] = []
  const checkpoints: string[] = []
  const loras: PromptTag[] = []
  const samplers: ComfySamplerNode[] = []
  let width: number | null = null
  let height: number | null = null

  const nodes = Array.isArray(payload.nodes) ? payload.nodes : []

  for (const rawNode of nodes) {
    const node = asObject(rawNode)
    if (!node) {
      continue
    }

    const nodeId = asNodeId(node.id)
    const classType = asString(node.type) ?? asString(node.class_type) ?? ''
    const inputs = asObject(node.inputs) ?? {}
    const widgets = getWidgets(node)

    if (classType === 'CLIPTextEncode') {
      const text = asString(inputs.text) ?? asString(widgets[0])
      const target = classifyPromptTarget(nodeId, classType, asString(node.title))
      if (target === 'negative') {
        pushUnique(negative, text)
      } else {
        pushUnique(positive, text)
      }
      continue
    }

    if (classType === 'KSampler') {
      const sampler: ComfySamplerNode = {
        nodeId,
        seed: asNumber(inputs.seed) ?? asNumber(widgets[0]),
        steps: asNumber(inputs.steps) ?? asNumber(widgets[2]),
        cfg: asNumber(inputs.cfg) ?? asNumber(widgets[3]),
        sampler: asString(inputs.sampler_name) ?? asString(widgets[4]),
        scheduler: asString(inputs.scheduler) ?? asString(widgets[5]),
        denoise: asNumber(inputs.denoise) ?? asNumber(widgets[6]),
      }
      samplers.push(sampler)
      continue
    }

    if (classType.includes('CheckpointLoader')) {
      pushUnique(checkpoints, asString(inputs.ckpt_name) ?? asString(widgets[0]))
      continue
    }

    if (classType.includes('LoraLoader') || classType.includes('LycorisLoader')) {
      pushUniqueLora(
        loras,
        asString(inputs.lora_name) ?? asString(inputs.lycoris_name) ?? asString(widgets[0]),
        asNumber(inputs.strength_model) ?? asNumber(widgets[1]),
      )
      continue
    }

    if (classType === 'EmptyLatentImage') {
      width = width ?? asNumber(inputs.width) ?? asNumber(widgets[0])
      height = height ?? asNumber(inputs.height) ?? asNumber(widgets[1])
    }
  }

  return {
    type: 'ComfyUI',
    format: 'ui_workflow',
    nodeCount: nodes.length,
    prompts: {
      positive,
      negative,
    },
    checkpoints,
    loras,
    samplers,
    size: { width, height },
    raw: payload,
  }
}

export class ComfyUIParser {
  parse(input: string | Record<string, unknown>): ParsedComfyUIPrompt {
    const resolved = resolveComfyPayload(input)

    if (resolved.format === 'ui_workflow') {
      return parseUiWorkflow(resolved.payload)
    }

    return parseApiPrompt(resolved.payload)
  }
}

export function parseComfyUIPrompt(input: string | Record<string, unknown>): ParsedComfyUIPrompt {
  return new ComfyUIParser().parse(input)
}
