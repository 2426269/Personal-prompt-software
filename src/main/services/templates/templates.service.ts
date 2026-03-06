import { AppError } from '@main/ipc/wrap-ipc'
import type { PromptTemplate, PromptTemplateInput } from '@shared/types/template'

import {
  PromptTemplatesRepository,
  type PromptTemplateRow,
} from '../../db/repositories/prompt-templates.repo'
import { getDefaultPromptTemplate } from '../llm/prompts/default-template'

function parseTemplateJson(value: string): PromptTemplate['templateJson'] {
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed as PromptTemplate['templateJson'] : []
  } catch {
    return []
  }
}

export class TemplatesService {
  constructor(private readonly repository = new PromptTemplatesRepository()) {
    this.ensureDefaultTemplate()
  }

  list(): PromptTemplate[] {
    this.ensureDefaultTemplate()
    return this.repository.list().map((row) => this.toTemplate(row))
  }

  get(id: string): PromptTemplate | null {
    this.ensureDefaultTemplate()
    const row = this.repository.getById(id)
    return row ? this.toTemplate(row) : null
  }

  getDefault(): PromptTemplate {
    this.ensureDefaultTemplate()
    const row = this.repository.getDefault()
    if (!row) {
      throw new AppError('TEMPLATE_NOT_FOUND', '默认分析模板不存在。')
    }

    return this.toTemplate(row)
  }

  save(input: PromptTemplateInput): PromptTemplate {
    const id = this.repository.upsert(input)
    const row = this.repository.getById(id)
    if (!row) {
      throw new AppError('TEMPLATE_SAVE_FAILED', '分析模板保存失败。')
    }

    return this.toTemplate(row)
  }

  delete(id: string): boolean {
    const currentDefault = this.repository.getDefault()
    if (currentDefault?.id === id && this.repository.count() <= 1) {
      throw new AppError('TEMPLATE_DELETE_BLOCKED', '至少需要保留一个分析模板。')
    }

    return this.repository.delete(id)
  }

  private ensureDefaultTemplate(): void {
    if (this.repository.count() > 0) {
      return
    }

    this.repository.upsert(getDefaultPromptTemplate())
  }

  private toTemplate(row: PromptTemplateRow): PromptTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      systemPrompt: row.system_prompt,
      templateJson: parseTemplateJson(row.template_json),
      mode: row.mode,
      isDefault: row.is_default === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
