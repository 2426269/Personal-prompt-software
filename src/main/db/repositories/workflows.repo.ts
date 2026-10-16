import { randomUUID } from 'node:crypto'

import type { Database } from 'better-sqlite3'

import type { WorkflowBindingTarget, WorkflowListParams } from '@shared/types/workflow'

import { getDatabase } from '../database'

export interface WorkflowRow {
  id: string
  name: string
  tags: string | null
  notes: string | null
  original_json: string
  clean_json: string | null
  api_prompt_json: string | null
  slot_map_json: string | null
  derived_from_entry_id: string | null
  is_default_test: number
  created_at: string
  updated_at: string
}

export interface WorkflowBindingRow {
  entry_id: string
  original_workflow_id: string | null
  clean_workflow_id: string | null
  preferred_test_workflow_id: string | null
  updated_at: string
}

export interface UpsertWorkflowInput {
  id?: string
  name: string
  tags?: string[]
  notes?: string | null
  originalJson: string
  cleanJson?: string | null
  apiPromptJson?: string | null
  slotMapJson?: string | null
  derivedFromEntryId?: string | null
  isDefaultTest?: boolean
}

function mapBindingTarget(target: Exclude<WorkflowBindingTarget, 'all'>): string {
  if (target === 'original') {
    return 'original_workflow_id'
  }

  if (target === 'clean') {
    return 'clean_workflow_id'
  }

  return 'preferred_test_workflow_id'
}

export class WorkflowsRepository {
  private readonly db: Database

  constructor(db: Database = getDatabase()) {
    this.db = db
  }

  list(params: WorkflowListParams = {}): WorkflowRow[] {
    if (params.derivedFromEntryId) {
      const statement = this.db.prepare<[string], WorkflowRow>(`
        SELECT *
        FROM workflows
        WHERE derived_from_entry_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `)

      return statement.all(params.derivedFromEntryId)
    }

    const statement = this.db.prepare<[], WorkflowRow>(`
      SELECT *
      FROM workflows
      ORDER BY is_default_test DESC, updated_at DESC, created_at DESC
    `)

    return statement.all()
  }

  getById(id: string): WorkflowRow | null {
    const statement = this.db.prepare<[string], WorkflowRow>(`
      SELECT *
      FROM workflows
      WHERE id = ?
      LIMIT 1
    `)

    return statement.get(id) ?? null
  }

  getByDerivedEntryId(entryId: string): WorkflowRow | null {
    const statement = this.db.prepare<[string], WorkflowRow>(`
      SELECT *
      FROM workflows
      WHERE derived_from_entry_id = ?
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1
    `)

    return statement.get(entryId) ?? null
  }

  upsertWorkflow(input: UpsertWorkflowInput): string {
    const workflowId = input.id ?? randomUUID()
    const statement = this.db.prepare(`
      INSERT INTO workflows (
        id,
        name,
        tags,
        notes,
        original_json,
        clean_json,
        api_prompt_json,
        slot_map_json,
        derived_from_entry_id,
        is_default_test,
        updated_at
      ) VALUES (
        @id,
        @name,
        @tags,
        @notes,
        @original_json,
        @clean_json,
        @api_prompt_json,
        @slot_map_json,
        @derived_from_entry_id,
        @is_default_test,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        tags=excluded.tags,
        notes=excluded.notes,
        original_json=excluded.original_json,
        clean_json=excluded.clean_json,
        api_prompt_json=excluded.api_prompt_json,
        slot_map_json=excluded.slot_map_json,
        derived_from_entry_id=excluded.derived_from_entry_id,
        is_default_test=excluded.is_default_test,
        updated_at=CURRENT_TIMESTAMP
    `)

    statement.run({
      id: workflowId,
      name: input.name,
      tags: JSON.stringify(input.tags ?? []),
      notes: input.notes ?? null,
      original_json: input.originalJson,
      clean_json: input.cleanJson ?? null,
      api_prompt_json: input.apiPromptJson ?? null,
      slot_map_json: input.slotMapJson ?? null,
      derived_from_entry_id: input.derivedFromEntryId ?? null,
      is_default_test: input.isDefaultTest ? 1 : 0,
    })

    return workflowId
  }

  saveSlotMap(workflowId: string, slotMapJson: string): boolean {
    const statement = this.db.prepare(`
      UPDATE workflows
      SET slot_map_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)

    return statement.run(slotMapJson, workflowId).changes > 0
  }

  setDefault(workflowId: string, isDefault: boolean): boolean {
    const tx = this.db.transaction(() => {
      if (isDefault) {
        this.db.prepare('UPDATE workflows SET is_default_test = 0 WHERE is_default_test != 0').run()
      }

      return this.db
        .prepare('UPDATE workflows SET is_default_test = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(isDefault ? 1 : 0, workflowId).changes > 0
    })

    return tx()
  }

  getBindingByEntryId(entryId: string): WorkflowBindingRow | null {
    const statement = this.db.prepare<[string], WorkflowBindingRow>(`
      SELECT *
      FROM entry_workflow_binding
      WHERE entry_id = ?
      LIMIT 1
    `)

    return statement.get(entryId) ?? null
  }

  upsertBinding(entryId: string, workflowId: string, target: WorkflowBindingTarget = 'all'): boolean {
    const tx = this.db.transaction(() => {
      const existing = this.getBindingByEntryId(entryId)
      const next = {
        originalWorkflowId:
          target === 'all' || target === 'original' ? workflowId : existing?.original_workflow_id ?? null,
        cleanWorkflowId: target === 'all' || target === 'clean' ? workflowId : existing?.clean_workflow_id ?? null,
        preferredTestWorkflowId:
          target === 'all' || target === 'preferred_test'
            ? workflowId
            : existing?.preferred_test_workflow_id ?? null,
      }

      const statement = this.db.prepare(`
        INSERT INTO entry_workflow_binding (
          entry_id,
          original_workflow_id,
          clean_workflow_id,
          preferred_test_workflow_id,
          updated_at
        ) VALUES (
          @entry_id,
          @original_workflow_id,
          @clean_workflow_id,
          @preferred_test_workflow_id,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT(entry_id) DO UPDATE SET
          original_workflow_id=excluded.original_workflow_id,
          clean_workflow_id=excluded.clean_workflow_id,
          preferred_test_workflow_id=excluded.preferred_test_workflow_id,
          updated_at=CURRENT_TIMESTAMP
      `)

      return (
        statement.run({
          entry_id: entryId,
          original_workflow_id: next.originalWorkflowId,
          clean_workflow_id: next.cleanWorkflowId,
          preferred_test_workflow_id: next.preferredTestWorkflowId,
        }).changes > 0
      )
    })

    return tx()
  }

  clearBinding(entryId: string, target: WorkflowBindingTarget = 'all'): boolean {
    if (target === 'all') {
      const statement = this.db.prepare('DELETE FROM entry_workflow_binding WHERE entry_id = ?')
      return statement.run(entryId).changes > 0
    }

    const tx = this.db.transaction(() => {
      const column = mapBindingTarget(target)
      const updateStatement = this.db.prepare(`
        UPDATE entry_workflow_binding
        SET ${column} = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE entry_id = ?
      `)

      const updated = updateStatement.run(entryId).changes > 0
      if (!updated) {
        return false
      }

      const binding = this.getBindingByEntryId(entryId)
      if (
        binding &&
        binding.original_workflow_id === null &&
        binding.clean_workflow_id === null &&
        binding.preferred_test_workflow_id === null
      ) {
        this.db.prepare('DELETE FROM entry_workflow_binding WHERE entry_id = ?').run(entryId)
      }

      return true
    })

    return tx()
  }
}
