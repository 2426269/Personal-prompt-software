import { AppError } from '@main/ipc/wrap-ipc'
import type {
  ComfyCancelInput,
  ComfyCancelResult,
  ComfyConnectionInput,
  ComfyConnectionResult,
  ComfyQueueStatusInput,
  ComfyQueueStatusResult,
  ComfySubmitInput,
  ComfySubmitResult,
} from '@shared/types/comfy'

import { WorkflowsService } from '../workflow/workflows.service'
import { ComfyUIClient } from './comfy-client'
import { PromptInjectionEngine } from './prompt-injection-engine'

export class ComfyService {
  constructor(
    private readonly workflowsService: WorkflowsService = new WorkflowsService(),
    private readonly comfyClient: ComfyUIClient = new ComfyUIClient(),
    private readonly promptInjectionEngine: PromptInjectionEngine = new PromptInjectionEngine(),
  ) {}

  testConnection(input: ComfyConnectionInput): Promise<ComfyConnectionResult> {
    return this.comfyClient.testConnection(input)
  }

  async submit(input: ComfySubmitInput): Promise<ComfySubmitResult> {
    const workflow = input.workflowId
      ? this.workflowsService.get(input.workflowId)
      : input.transientWorkflow
        ? this.workflowsService.buildTransientWorkflow(input.transientWorkflow)
        : null

    if (!workflow) {
      throw new AppError('WORKFLOW_NOT_FOUND', '找不到要提交的工作流。')
    }

    const prompt = this.promptInjectionEngine.buildPrompt(workflow, input.overrides)
    const queued = await this.comfyClient.queuePrompt(input.connection, prompt)

    return {
      promptId: queued.promptId,
      clientId: queued.clientId,
      workflowId: input.workflowId ?? null,
      entryId: input.entryId ?? null,
      imageIndex: input.imageIndex ?? null,
      status: 'queued',
      queuedAt: new Date().toISOString(),
      normalizedBaseUrl: queued.normalizedBaseUrl,
    }
  }

  getQueueStatus(input: ComfyQueueStatusInput): Promise<ComfyQueueStatusResult> {
    return this.comfyClient.getQueueStatus(input.connection, input.promptId)
  }

  cancel(input: ComfyCancelInput): Promise<ComfyCancelResult> {
    return this.comfyClient.interrupt(input.connection, input.promptId)
  }
}
