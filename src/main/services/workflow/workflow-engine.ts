import type { ComfyUIWorkflowFormat } from '@shared/types/importer'
import type {
  WorkflowCleanRules,
  WorkflowCleanResult,
  WorkflowRunnableSource,
  WorkflowSlotMapItem,
} from '@shared/types/workflow'

import { asObject, extractJsonChunks, safeJsonParse } from '../parser/json-utils'

export interface ResolvedWorkflow {
  format: ComfyUIWorkflowFormat
  payload: Record<string, unknown>
  nodeCount: number
}

export interface ResolvedRunnableWorkflow {
  runnable: boolean
  runnableSource: WorkflowRunnableSource
  payloadJson: string | null
  nonRunnableReason: string | null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

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

function asNodeId(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }

  return ''
}

function isComfyApiObject(payload: Record<string, unknown>): boolean {
  const values = Object.values(payload)
  return values.length > 0 && values.every((node) => {
    const objectNode = asObject(node)
    return !!objectNode && typeof objectNode.class_type === 'string' && asObject(objectNode.inputs) !== null
  })
}

function parseApiPromptCandidate(candidate: string | null | undefined): Record<string, unknown> | null {
  if (!candidate) {
    return null
  }

  const parsed = asObject(safeJsonParse(candidate))
  if (!parsed) {
    return null
  }

  return isComfyApiObject(parsed) ? parsed : null
}

function isComfyUIWorkflow(payload: Record<string, unknown>): boolean {
  return Array.isArray(payload.nodes) && Array.isArray(payload.links)
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function classifyPromptTarget(nodeId: string, classType: string, title: string | null): 'positive' | 'negative' {
  const fingerprint = `${nodeId} ${classType} ${title ?? ''}`.toLowerCase()
  return fingerprint.includes('negative') || fingerprint.includes('neg') ? 'negative' : 'positive'
}

function isPromptTextClass(classType: string): boolean {
  const normalized = classType.toLowerCase()
  return normalized.includes('cliptextencode') || (normalized.includes('clip') && normalized.includes('textencode'))
}

function isLoraClass(classType: string): boolean {
  const normalized = classType.toLowerCase()
  return normalized.includes('lora') || normalized.includes('lycoris')
}

function isNoteNode(classType: string, title: string | null): boolean {
  const fingerprint = `${classType} ${title ?? ''}`.toLowerCase()
  return fingerprint.includes('note') || fingerprint.includes('comment') || fingerprint.includes('注释')
}

function sanitizePathLikeValue(value: string | null): string | null {
  if (!value) {
    return value
  }

  const parts = value.split(/[\\/]/).filter((part) => part.length > 0)
  return parts.at(-1) ?? value
}

function sanitizeInputPathField(inputs: Record<string, unknown> | null, key: string): void {
  if (!inputs || !(key in inputs)) {
    return
  }

  inputs[key] = sanitizePathLikeValue(asString(inputs[key])) ?? inputs[key]
}

function defaultRules(rules?: WorkflowCleanRules): Required<WorkflowCleanRules> {
  return {
    clearPrompts: rules?.clearPrompts ?? true,
    placeholderPositive: rules?.placeholderPositive ?? '{{positive}}',
    placeholderNegative: rules?.placeholderNegative ?? '{{negative}}',
    randomizeSeed: rules?.randomizeSeed ?? true,
    clearLoadImages: rules?.clearLoadImages ?? true,
    stripUiMetadata: rules?.stripUiMetadata ?? true,
    anonymizePaths: rules?.anonymizePaths ?? true,
    removeNoteNodes: rules?.removeNoteNodes ?? false,
  }
}

function stringifyWorkflow(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, null, 2)
}

export class WorkflowEngine {
  resolve(input: string | Record<string, unknown>): ResolvedWorkflow {
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
        return {
          format: 'api_prompt',
          payload: candidate,
          nodeCount: Object.keys(candidate).length,
        }
      }

      if (isComfyUIWorkflow(candidate)) {
        return {
          format: 'ui_workflow',
          payload: candidate,
          nodeCount: Array.isArray(candidate.nodes) ? candidate.nodes.length : 0,
        }
      }
    }

    throw new Error('无法识别 ComfyUI 工作流格式。')
  }

  guessSlotMap(input: string | Record<string, unknown>): WorkflowSlotMapItem[] {
    const resolved = this.resolve(input)
    return resolved.format === 'api_prompt'
      ? this.guessApiPromptSlotMap(resolved.payload)
      : this.guessUiWorkflowSlotMap(resolved.payload)
  }

  cleanWorkflow(input: string | Record<string, unknown>, rules?: WorkflowCleanRules): WorkflowCleanResult {
    const resolved = this.resolve(input)
    const normalizedRules = defaultRules(rules)
    const cloned = deepClone(resolved.payload)

    if (resolved.format === 'api_prompt') {
      for (const [nodeId, rawNode] of Object.entries(cloned)) {
        const node = asObject(rawNode)
        const inputs = node ? asObject(node.inputs) : null
        const classType = node ? asString(node.class_type) : null

        if (!node || !inputs || !classType) {
          continue
        }

        if (isPromptTextClass(classType) && normalizedRules.clearPrompts) {
          const title = asString(asObject(node._meta)?.title)
          inputs.text =
            classifyPromptTarget(nodeId, classType, title) === 'negative'
              ? normalizedRules.placeholderNegative
              : normalizedRules.placeholderPositive
        }

        if (classType === 'KSampler' && normalizedRules.randomizeSeed) {
          inputs.seed = -1
        }

        if (classType.includes('LoadImage') && normalizedRules.clearLoadImages && 'image' in inputs) {
          inputs.image = ''
        }

        if (normalizedRules.anonymizePaths) {
          if (classType.includes('CheckpointLoader')) {
            sanitizeInputPathField(inputs, 'ckpt_name')
          }

          if (isLoraClass(classType)) {
            sanitizeInputPathField(inputs, 'lora_name')
            sanitizeInputPathField(inputs, 'lycoris_name')
          }
        }
      }
    } else {
      const nodes = Array.isArray(cloned.nodes) ? cloned.nodes : []
      const nextNodes: Record<string, unknown>[] = []

      for (const rawNode of nodes) {
        const node = asObject(rawNode)
        if (!node) {
          continue
        }

        const classType = asString(node.type) ?? asString(node.class_type) ?? ''
        const title = asString(node.title)
        if (normalizedRules.removeNoteNodes && isNoteNode(classType, title)) {
          continue
        }

        const inputs = asObject(node.inputs)
        const widgets: unknown[] | null = Array.isArray(node.widgets_values) ? (node.widgets_values as unknown[]) : null
        const nodeId = asNodeId(node.id)

        if (isPromptTextClass(classType) && normalizedRules.clearPrompts) {
          const placeholder =
            classifyPromptTarget(nodeId, classType, title) === 'negative'
              ? normalizedRules.placeholderNegative
              : normalizedRules.placeholderPositive

          if (inputs && 'text' in inputs) {
            inputs.text = placeholder
          }

          if (widgets && widgets.length > 0) {
            widgets[0] = placeholder
          }
        }

        if (classType === 'KSampler' && normalizedRules.randomizeSeed) {
          if (inputs && 'seed' in inputs) {
            inputs.seed = -1
          }

          if (widgets && widgets.length > 0) {
            widgets[0] = -1
          }
        }

        if (classType.includes('LoadImage') && normalizedRules.clearLoadImages) {
          if (inputs && 'image' in inputs) {
            inputs.image = ''
          }

          if (widgets && widgets.length > 0) {
            widgets[0] = ''
          }
        }

        if (normalizedRules.anonymizePaths) {
          if (classType.includes('CheckpointLoader')) {
            sanitizeInputPathField(inputs, 'ckpt_name')
          }

          if (classType.includes('CheckpointLoader') && widgets && widgets.length > 0) {
            widgets[0] = sanitizePathLikeValue(asString(widgets[0])) ?? widgets[0]
          }

          if (isLoraClass(classType)) {
            sanitizeInputPathField(inputs, 'lora_name')
            sanitizeInputPathField(inputs, 'lycoris_name')
          }

          if (isLoraClass(classType) && widgets && widgets.length > 0) {
            widgets[0] = sanitizePathLikeValue(asString(widgets[0])) ?? widgets[0]
          }
        }

        if (normalizedRules.stripUiMetadata) {
          delete node.pos
          delete node.size
          delete node.flags
          delete node.order
        }

        nextNodes.push(node)
      }

      cloned.nodes = nextNodes

      if (normalizedRules.stripUiMetadata) {
        delete cloned.extra
        delete cloned.config
        delete cloned.state
        delete cloned.version
      }
    }

    const workflowJson = stringifyWorkflow(cloned)
    const runnable = this.resolveRunnablePayload({
      format: resolved.format,
      originalJson: resolved.format === 'api_prompt' ? workflowJson : null,
      cleanJson: workflowJson,
      apiPromptJson: resolved.format === 'api_prompt' ? workflowJson : null,
    })

    return {
      format: resolved.format,
      nodeCount: resolved.nodeCount,
      workflowJson,
      slotMap: this.guessSlotMap(cloned),
      runnable: runnable.runnable,
      runnableSource: runnable.runnableSource,
      nonRunnableReason: runnable.nonRunnableReason,
    }
  }

  stringifyOriginal(input: string | Record<string, unknown>): string {
    return stringifyWorkflow(this.resolve(input).payload)
  }

  toApiPromptJson(input: string | Record<string, unknown>): string | null {
    const resolved = this.resolve(input)
    return resolved.format === 'api_prompt' ? stringifyWorkflow(resolved.payload) : null
  }

  resolveRunnablePayload(input: {
    format: ComfyUIWorkflowFormat
    originalJson: string | null
    cleanJson?: string | null
    apiPromptJson?: string | null
  }): ResolvedRunnableWorkflow {
    const cleanPayload = parseApiPromptCandidate(input.cleanJson ?? null)
    if (cleanPayload) {
      return {
        runnable: true,
        runnableSource: 'clean_json',
        payloadJson: stringifyWorkflow(cleanPayload),
        nonRunnableReason: null,
      }
    }

    const apiPromptPayload = parseApiPromptCandidate(input.apiPromptJson ?? null)
    if (apiPromptPayload) {
      return {
        runnable: true,
        runnableSource: 'api_prompt_json',
        payloadJson: stringifyWorkflow(apiPromptPayload),
        nonRunnableReason: null,
      }
    }

    if (input.format === 'api_prompt') {
      const originalPayload = parseApiPromptCandidate(input.originalJson)
      if (originalPayload) {
        return {
          runnable: true,
          runnableSource: 'original_json',
          payloadJson: stringifyWorkflow(originalPayload),
          nonRunnableReason: null,
        }
      }
    }

    return {
      runnable: false,
      runnableSource: null,
      payloadJson: null,
      nonRunnableReason:
        input.format === 'ui_workflow'
          ? '当前工作流只有 UI workflow，没有可直接提交的 API prompt。'
          : '当前工作流没有可识别的 API prompt。',
    }
  }

  summarize(input: string | Record<string, unknown>): Pick<ResolvedWorkflow, 'format' | 'nodeCount'> {
    const resolved = this.resolve(input)
    return {
      format: resolved.format,
      nodeCount: resolved.nodeCount,
    }
  }

  private guessApiPromptSlotMap(payload: Record<string, unknown>): WorkflowSlotMapItem[] {
    const slotMap: WorkflowSlotMapItem[] = []

    for (const [nodeId, rawNode] of Object.entries(payload)) {
      const node = asObject(rawNode)
      const inputs = node ? asObject(node.inputs) : null
      const classType = node ? asString(node.class_type) : null
      if (!node || !inputs || !classType) {
        continue
      }

      const title = asString(asObject(node._meta)?.title)

      if (isPromptTextClass(classType)) {
        slotMap.push({
          nodeId,
          classType,
          slotType: classifyPromptTarget(nodeId, classType, title) === 'negative' ? 'negative_prompt' : 'positive_prompt',
          path: 'inputs.text',
          currentValue: inputs.text ?? null,
          title,
        })
        continue
      }

      if (classType === 'KSampler') {
        slotMap.push({
          nodeId,
          classType,
          slotType: 'sampler',
          path: 'inputs',
          currentValue: {
            seed: asNumber(inputs.seed),
            steps: asNumber(inputs.steps),
            cfg: asNumber(inputs.cfg),
            sampler_name: asString(inputs.sampler_name) ?? asString(inputs.sampler),
            scheduler: asString(inputs.scheduler),
            denoise: asNumber(inputs.denoise),
          },
          title,
          editableKeys: ['seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise'],
        })
        continue
      }

      if (classType.includes('CheckpointLoader')) {
        slotMap.push({
          nodeId,
          classType,
          slotType: 'checkpoint',
          path: 'inputs.ckpt_name',
          currentValue: inputs.ckpt_name ?? null,
          title,
        })
        continue
      }

      if (isLoraClass(classType)) {
        slotMap.push({
          nodeId,
          classType,
          slotType: 'lora',
          path: 'inputs.lora_name',
          currentValue: inputs.lora_name ?? inputs.lycoris_name ?? null,
          title,
          editableKeys: ['lora_name', 'lycoris_name', 'strength_model', 'strength_clip'],
        })
        continue
      }

      if (classType.includes('LoadImage')) {
        slotMap.push({
          nodeId,
          classType,
          slotType: 'load_image',
          path: 'inputs.image',
          currentValue: inputs.image ?? null,
          title,
        })
      }
    }

    return slotMap
  }

  private guessUiWorkflowSlotMap(payload: Record<string, unknown>): WorkflowSlotMapItem[] {
    const nodes = Array.isArray(payload.nodes) ? payload.nodes : []
    const slotMap: WorkflowSlotMapItem[] = []

    for (const rawNode of nodes) {
      const node = asObject(rawNode)
      if (!node) {
        continue
      }

      const nodeId = asNodeId(node.id)
      const classType = asString(node.type) ?? asString(node.class_type) ?? ''
      const title = asString(node.title)
      const inputs = asObject(node.inputs)
      const widgets: unknown[] = Array.isArray(node.widgets_values) ? (node.widgets_values as unknown[]) : []

      if (isPromptTextClass(classType)) {
        slotMap.push({
          nodeId,
          classType,
          slotType: classifyPromptTarget(nodeId, classType, title) === 'negative' ? 'negative_prompt' : 'positive_prompt',
          path: 'widgets_values[0]',
          currentValue: asString(inputs?.text) ?? widgets[0] ?? null,
          title,
          widgetIndexes: { text: 0 },
        })
        continue
      }

      if (classType === 'KSampler') {
        slotMap.push({
          nodeId,
          classType,
          slotType: 'sampler',
          path: 'widgets_values',
          currentValue: {
            seed: asNumber(inputs?.seed) ?? asNumber(widgets[0]),
            steps: asNumber(inputs?.steps) ?? asNumber(widgets[2]),
            cfg: asNumber(inputs?.cfg) ?? asNumber(widgets[3]),
            sampler_name: asString(inputs?.sampler_name) ?? asString(widgets[4]),
            scheduler: asString(inputs?.scheduler) ?? asString(widgets[5]),
            denoise: asNumber(inputs?.denoise) ?? asNumber(widgets[6]),
          },
          title,
          editableKeys: ['seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise'],
          widgetIndexes: { seed: 0, steps: 2, cfg: 3, sampler_name: 4, scheduler: 5, denoise: 6 },
        })
        continue
      }

      if (classType.includes('CheckpointLoader')) {
        slotMap.push({
          nodeId,
          classType,
          slotType: 'checkpoint',
          path: 'widgets_values[0]',
          currentValue: asString(inputs?.ckpt_name) ?? widgets[0] ?? null,
          title,
          widgetIndexes: { ckpt_name: 0 },
        })
        continue
      }

      if (isLoraClass(classType)) {
        slotMap.push({
          nodeId,
          classType,
          slotType: 'lora',
          path: 'widgets_values[0]',
          currentValue: asString(inputs?.lora_name) ?? asString(inputs?.lycoris_name) ?? widgets[0] ?? null,
          title,
          editableKeys: ['lora_name', 'lycoris_name', 'strength_model', 'strength_clip'],
          widgetIndexes: { lora_name: 0, strength_model: 1, strength_clip: 2 },
        })
        continue
      }

      if (classType.includes('LoadImage')) {
        slotMap.push({
          nodeId,
          classType,
          slotType: 'load_image',
          path: 'widgets_values[0]',
          currentValue: asString(inputs?.image) ?? widgets[0] ?? null,
          title,
          widgetIndexes: { image: 0 },
        })
      }
    }

    return slotMap
  }
}
