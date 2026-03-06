import { AppError } from '@main/ipc/wrap-ipc'
import type { EntryTagAssignInput, UserTag, UserTagInput } from '@shared/types/tag'

import { TagsRepository, type UserTagRow } from '../../db/repositories/tags.repo'

export class TagsService {
  constructor(private readonly repository = new TagsRepository()) {}

  list(): UserTag[] {
    return this.repository.list().map((row) => this.toTag(row))
  }

  create(input: UserTagInput): UserTag {
    const id = this.repository.create(input)
    const tag = this.repository.list().find((item) => item.id === id)
    if (!tag) {
      throw new AppError('TAG_CREATE_FAILED', '标签创建失败。')
    }

    return this.toTag(tag)
  }

  update(input: UserTagInput): UserTag {
    if (!input.id) {
      throw new AppError('TAG_ID_REQUIRED', '更新标签时必须提供 id。')
    }

    const updated = this.repository.update(input)
    if (!updated) {
      throw new AppError('TAG_NOT_FOUND', '标签不存在或未发生变更。')
    }

    const tag = this.repository.list().find((item) => item.id === input.id)
    if (!tag) {
      throw new AppError('TAG_NOT_FOUND', '标签不存在。')
    }

    return this.toTag(tag)
  }

  delete(id: string): boolean {
    return this.repository.delete(id)
  }

  assign(input: EntryTagAssignInput): UserTag[] {
    this.repository.assignToEntry(input)
    return this.repository.getByEntryId(input.entryId).map((row) => this.toTag(row))
  }

  getByEntryId(entryId: string): UserTag[] {
    return this.repository.getByEntryId(entryId).map((row) => this.toTag(row))
  }

  private toTag(row: UserTagRow): UserTag {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
