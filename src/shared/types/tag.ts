export interface UserTag {
  id: string
  name: string
  color: string
  createdAt: string
  updatedAt: string | null
}

export interface UserTagInput {
  id?: string
  name: string
  color: string
}

export interface EntryTagAssignInput {
  entryId: string
  tagIds: string[]
}
