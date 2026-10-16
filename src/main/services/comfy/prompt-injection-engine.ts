import { AppError } from '@main/ipc/wrap-ipc'
import type { ComfyPromptOverrides } from '@shared/types/comfy'
import type { WorkflowDetail, WorkflowSlotMapItem } from '@shared/types/workflow'

import { asObject } from '../parser/json-utils'
import { WorkflowEngine } from '../workflow/workflow-engine'

function asInputKey(path: string): string | null {
  const match = path.match(/^inputs\.([a-zA-Z0-9_]+)$/)
  return match?.[1] ?? null
}

function parsePromptPayload(payloadText: string): Record<string, unknown> {
  const parsed = JSON.parse(payloadText) as unknown
  const objectPayload = asObject(parsed)
  if (!objectPayload) {
    throw new AppError('COMFY_WORKFLOW_INVALID', '工作流 JSON 不是有效的 API prompt。')
  }

  return objectPayload
}

export class PromptInjectionEngine {
  constructor(private readonly workflowEngine: WorkflowEngine = new WorkflowEngine()) {}

  buildPrompt(workflow: WorkflowDetail, overrides: ComfyPromptOverrides): Record<string, unknown> {
    const runnable = this.workflowEngine.resolveRunnablePayload({
      format: workflow.format,
      originalJson: workflow.originalJson,
      cleanJson: workflow.cleanJson,
      apiPromptJson: workflow.apiPromptJson,
    })
    const payloadText = runnable.payloadJson

    if (!payloadText) {
      throw new AppError(
        'COMFY_WORKFLOW_NOT_RUNNABLE',
        runnable.nonRunnableReason ?? '当前工作流没有可直接提交的 API prompt。',
      )
    }

    const payload = parsePromptPayload(payloadText)
    const slotMap = workflow.slotMap
    const hasPromptSlot = slotMap.some((slot) => slot.slotType === 'positive_prompt' || slot.slotType === 'negative_prompt')
    if (!hasPromptSlot) {
      throw new AppError('COMFY_WORKFLOW_NO_PROMPT_SLOT', '当前工作流未识别到可注入的提示词插槽。')
    }

    for (const slot of slotMap) {
      this.applySlot(payload, slot, overrides)
    }

    return payload
  }

  private applySlot(payload: Record<string, unknown>, slot: WorkflowSlotMapItem, overrides: ComfyPromptOverrides): void {
    const node = asObject(payload[slot.nodeId])
    const inputs = node ? asObject(node.inputs) : null
    if (!node || !inputs) {
      return
    }

    if (slot.slotType === 'positive_prompt') {
      const inputKey = asInputKey(slot.path) ?? 'text'
      inputs[inputKey] = overrides.positivePrompt
      return
    }

    if (slot.slotType === 'negative_prompt') {
      const inputKey = asInputKey(slot.path) ?? 'text'
      inputs[inputKey] = overrides.negativePrompt ?? ''
      return
    }

    if (slot.slotType === 'checkpoint' && overrides.checkpoint) {
      const inputKey = asInputKey(slot.path) ?? 'ckpt_name'
      inputs[inputKey] = overrides.checkpoint
      return
    }

    if (slot.slotType === 'sampler') {
      if (overrides.seed !== undefined && overrides.seed !== null) {
        inputs.seed = overrides.seed
      }
      if (overrides.steps !== undefined && overrides.steps !== null) {
        inputs.steps = overrides.steps
      }
      if (overrides.cfg !== undefined && overrides.cfg !== null) {
        inputs.cfg = overrides.cfg
      }
      if (overrides.samplerName) {
        if ('sampler_name' in inputs) {
          inputs.sampler_name = overrides.samplerName
        } else if ('sampler' in inputs) {
          inputs.sampler = overrides.samplerName
        }
      }
      if (overrides.scheduler) {
        inputs.scheduler = overrides.scheduler
      }
      if (overrides.denoise !== undefined && overrides.denoise !== null) {
        inputs.denoise = overrides.denoise
      }
    }
  }
}
