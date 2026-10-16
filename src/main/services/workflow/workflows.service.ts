import fs from 'node:fs/promises'
import path from 'node:path'

import { app } from 'electron'

import { AppError } from '@main/ipc/wrap-ipc'
import type {
  WorkflowBindInput,
  WorkflowBinding,
  WorkflowCleanInput,
  WorkflowCleanResult,
  WorkflowDetail,
  WorkflowExportInput,
  WorkflowListParams,
  WorkflowRefreshInput,
  WorkflowSetDefaultInput,
  WorkflowSlotMapGuessInput,
  WorkflowSlotMapItem,
  WorkflowSlotMapSaveInput,
  WorkflowSummary,
  WorkflowUnbindInput,
} from '@shared/types/workflow'

import {
  WorkflowsRepository,
  type WorkflowBindingRow,
  type WorkflowRow,
} from '../../db/repositories/workflows.repo'
import { WorkflowEngine } from './workflow-engine'

function parseStringArray(value: string | null): string[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function parseSlotMap(value: string | null): WorkflowSlotMapItem[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? (parsed as WorkflowSlotMapItem[]) : []
  } catch {
    return []
  }
}

function sanitizeFileName(value: string): string {
  const invalidChars = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*'])
  const sanitized = [...value]
    .map((char) => {
      const code = char.charCodeAt(0)
      return invalidChars.has(char) || code < 32 ? '_' : char
    })
    .join('')
    .trim()

  return sanitized || 'workflow'
}

export interface EnsureWorkflowForEntryInput {
  entryId: string
  name: string
  workflowJson: string | Record<string, unknown>
  runnableWorkflowJson?: string | Record<string, unknown> | null
}

export interface BuildTransientWorkflowInput {
  name?: string
  workflowJson: string | Record<string, unknown>
  runnableWorkflowJson?: string | Record<string, unknown> | null
}

export class WorkflowsService {
  constructor(
    private readonly repository: WorkflowsRepository = new WorkflowsRepository(),
    private readonly engine: WorkflowEngine = new WorkflowEngine(),
  ) {}

  list(params: WorkflowListParams = {}): WorkflowSummary[] {
    return this.repository.list(params).map((row) => this.toSummary(row))
  }

  get(id: string): WorkflowDetail | null {
    const row = this.repository.getById(id)
    return row ? this.toDetail(row) : null
  }

  getBindingByEntryId(entryId: string): WorkflowBinding | null {
    const row = this.repository.getBindingByEntryId(entryId)
    return row ? this.toBinding(row) : null
  }

  guessSlotMap(input: WorkflowSlotMapGuessInput): WorkflowSlotMapItem[] {
    return this.engine.guessSlotMap(input.workflowJson)
  }

  clean(input: WorkflowCleanInput): WorkflowCleanResult {
    if (!input.workflowId && !input.workflowJson) {
      throw new AppError('WORKFLOW_INPUT_REQUIRED', '请提供 workflowId 或 workflowJson。')
    }

    const source = input.workflowJson ?? this.requireWorkflow(input.workflowId ?? '').originalJson
    return this.engine.cleanWorkflow(source, input.rules)
  }

  refresh(input: WorkflowRefreshInput): WorkflowDetail {
    const existing = this.requireWorkflow(input.workflowId)
    const sourceForClean = existing.apiPromptJson ?? existing.originalJson
    const cleanResult = this.engine.cleanWorkflow(sourceForClean, input.rules)
    const slotMap = this.engine.guessSlotMap(sourceForClean)

    this.repository.upsertWorkflow({
      id: existing.id,
      name: existing.name,
      tags: existing.tags,
      notes: existing.notes,
      originalJson: existing.originalJson,
      cleanJson: cleanResult.workflowJson,
      apiPromptJson: existing.apiPromptJson,
      slotMapJson: JSON.stringify(slotMap, null, 2),
      derivedFromEntryId: existing.derivedFromEntryId,
      isDefaultTest: existing.isDefaultTest,
    })

    return this.requireWorkflow(input.workflowId)
  }

  saveSlotMap(input: WorkflowSlotMapSaveInput): WorkflowDetail {
    const saved = this.repository.saveSlotMap(input.workflowId, JSON.stringify(input.slotMap, null, 2))
    if (!saved) {
      throw new AppError('WORKFLOW_NOT_FOUND', '工作流不存在，无法保存 SlotMap。')
    }

    return this.requireWorkflow(input.workflowId)
  }

  setDefault(input: WorkflowSetDefaultInput): boolean {
    const existing = this.repository.getById(input.workflowId)
    if (!existing) {
      throw new AppError('WORKFLOW_NOT_FOUND', '工作流不存在，无法设为默认。')
    }

    return this.repository.setDefault(input.workflowId, input.isDefault)
  }

  bind(input: WorkflowBindInput): boolean {
    const existing = this.repository.getById(input.workflowId)
    if (!existing) {
      throw new AppError('WORKFLOW_NOT_FOUND', '工作流不存在，无法绑定。')
    }

    return this.repository.upsertBinding(input.entryId, input.workflowId, input.target ?? 'preferred_test')
  }

  unbind(input: WorkflowUnbindInput): boolean {
    return this.repository.clearBinding(input.entryId, input.target ?? 'all')
  }

  async export(input: WorkflowExportInput): Promise<string> {
    const workflow = this.requireWorkflow(input.workflowId)
    let content = ''
    const extension = 'json'

    if (input.type === 'original') {
      content = workflow.originalJson
    } else if (input.type === 'clean') {
      if (!workflow.cleanJson) {
        throw new AppError('WORKFLOW_CLEAN_MISSING', '该工作流还没有 clean_json。')
      }
      content = workflow.cleanJson
    } else if (input.type === 'api_prompt') {
      if (!workflow.apiPromptJson) {
        throw new AppError('WORKFLOW_API_PROMPT_MISSING', '该工作流不是 API Prompt 格式。')
      }
      content = workflow.apiPromptJson
    } else {
      content = JSON.stringify(workflow.slotMap, null, 2)
    }

    const downloadsDir = app.getPath('downloads')
    const fileName = `${sanitizeFileName(workflow.name)}-${input.type}.${extension}`
    const targetPath = path.join(downloadsDir, fileName)
    await fs.writeFile(targetPath, content, 'utf-8')
    return targetPath
  }

  ensureWorkflowForEntry(input: EnsureWorkflowForEntryInput): WorkflowDetail {
    const existingBinding = this.repository.getBindingByEntryId(input.entryId)
    const existingWorkflow =
      (existingBinding?.original_workflow_id
        ? this.repository.getById(existingBinding.original_workflow_id)
        : null) ?? this.repository.getByDerivedEntryId(input.entryId)

    const runnableSource = input.runnableWorkflowJson ?? input.workflowJson
    const cleanResult = this.engine.cleanWorkflow(runnableSource)
    const originalJson = this.engine.stringifyOriginal(input.workflowJson)
    const apiPromptJson = input.runnableWorkflowJson
      ? this.engine.stringifyOriginal(input.runnableWorkflowJson)
      : this.engine.toApiPromptJson(input.workflowJson)
    const originalSlotMap = this.engine.guessSlotMap(runnableSource)

    const workflowId = this.repository.upsertWorkflow({
      id: existingWorkflow?.id,
      name: input.name,
      originalJson,
      cleanJson: cleanResult.workflowJson,
      apiPromptJson,
      slotMapJson: JSON.stringify(originalSlotMap, null, 2),
      derivedFromEntryId: input.entryId,
      isDefaultTest: existingWorkflow?.is_default_test === 1,
    })

    this.repository.upsertBinding(input.entryId, workflowId, 'all')
    return this.requireWorkflow(workflowId)
  }

  buildTransientWorkflow(input: BuildTransientWorkflowInput): WorkflowDetail {
    const runnableSource = input.runnableWorkflowJson ?? input.workflowJson
    const cleanResult = this.engine.cleanWorkflow(runnableSource)
    const originalJson = this.engine.stringifyOriginal(input.workflowJson)
    const apiPromptJson = input.runnableWorkflowJson
      ? this.engine.stringifyOriginal(input.runnableWorkflowJson)
      : this.engine.toApiPromptJson(input.workflowJson)
    const slotMap = this.engine.guessSlotMap(runnableSource)
    const meta = this.engine.summarize(input.workflowJson)

    return {
      id: '',
      name: input.name?.trim() || 'Transient Workflow',
      tags: [],
      notes: null,
      format: meta.format,
      nodeCount: meta.nodeCount,
      derivedFromEntryId: null,
      isDefaultTest: false,
      runnable: cleanResult.runnable,
      runnableSource: cleanResult.runnableSource,
      nonRunnableReason: cleanResult.nonRunnableReason,
      createdAt: '',
      updatedAt: '',
      originalJson,
      cleanJson: cleanResult.workflowJson,
      apiPromptJson,
      slotMap,
    }
  }

  private requireWorkflow(id: string): WorkflowDetail {
    const row = this.repository.getById(id)
    if (!row) {
      throw new AppError('WORKFLOW_NOT_FOUND', '工作流不存在。')
    }

    return this.toDetail(row)
  }

  private toSummary(row: WorkflowRow): WorkflowSummary {
    const meta = this.engine.summarize(row.original_json)
    const runnable = this.engine.resolveRunnablePayload({
      format: meta.format,
      originalJson: row.original_json,
      cleanJson: row.clean_json,
      apiPromptJson: row.api_prompt_json,
    })

    return {
      id: row.id,
      name: row.name,
      tags: parseStringArray(row.tags),
      notes: row.notes,
      format: meta.format,
      nodeCount: meta.nodeCount,
      derivedFromEntryId: row.derived_from_entry_id,
      isDefaultTest: row.is_default_test === 1,
      runnable: runnable.runnable,
      runnableSource: runnable.runnableSource,
      nonRunnableReason: runnable.nonRunnableReason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private toDetail(row: WorkflowRow): WorkflowDetail {
    const summary = this.toSummary(row)
    return {
      ...summary,
      originalJson: row.original_json,
      cleanJson: row.clean_json,
      apiPromptJson: row.api_prompt_json,
      slotMap: parseSlotMap(row.slot_map_json),
    }
  }

  private toBinding(row: WorkflowBindingRow): WorkflowBinding {
    return {
      entryId: row.entry_id,
      originalWorkflowId: row.original_workflow_id,
      cleanWorkflowId: row.clean_workflow_id,
      preferredTestWorkflowId: row.preferred_test_workflow_id,
      updatedAt: row.updated_at,
    }
  }
}
