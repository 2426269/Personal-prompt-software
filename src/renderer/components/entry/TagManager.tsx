import type { UserTag } from '@shared/types/tag'
import { useCallback, useEffect, useMemo, useState } from 'react'
import styles from './TagManager.module.css'

const RANDOM_COLORS = [
  '#1f6feb', '#a371f7', '#f78166', '#3fb950', '#d29922',
  '#f47067', '#79c0ff', '#56d364', '#e3b341', '#db61a2',
]

interface TagManagerProps {
  entryId: string
  currentTags: UserTag[]
  onTagsChanged: (tags: UserTag[]) => void
}

export function TagManager({ entryId, currentTags, onTagsChanged }: TagManagerProps) {
  const [allTags, setAllTags] = useState<UserTag[]>([])
  const [search, setSearch] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const loadTags = useCallback(async () => {
    try {
      const res = await window.api.listTags()
      if (res.success && res.data) {
        setAllTags(res.data)
      }
    } catch (err) {
      console.error('Failed to load tags:', err)
    }
  }, [])

  useEffect(() => {
    void loadTags()
  }, [loadTags])

  const currentTagIds = useMemo(() => new Set(currentTags.map(t => t.id)), [currentTags])

  const filtered = useMemo(() => {
    if (!search.trim()) return allTags.filter(t => !currentTagIds.has(t.id))
    const q = search.toLowerCase()
    return allTags.filter(t => !currentTagIds.has(t.id) && t.name.toLowerCase().includes(q))
  }, [allTags, currentTagIds, search])

  const exactMatch = useMemo(() => {
    return allTags.some(t => t.name.toLowerCase() === search.trim().toLowerCase())
  }, [allTags, search])

  const handleAddTag = async (tag: UserTag) => {
    const newTagIds = [...currentTags.map(t => t.id), tag.id]
    try {
      const res = await window.api.assignTagsToEntry({ entryId, tagIds: newTagIds })
      if (res.success && res.data) {
        onTagsChanged(res.data)
        void loadTags()
      }
    } catch (err) {
      console.error('Failed to assign tag:', err)
    }
    setSearch('')
  }

  const handleRemoveTag = async (tagId: string) => {
    const newTagIds = currentTags.filter(t => t.id !== tagId).map(t => t.id)
    try {
      const res = await window.api.assignTagsToEntry({ entryId, tagIds: newTagIds })
      if (res.success && res.data) {
        onTagsChanged(res.data)
      }
    } catch (err) {
      console.error('Failed to remove tag:', err)
    }
  }

  const handleCreateTag = async () => {
    const name = search.trim()
    if (!name || isCreating) return
    try {
      setIsCreating(true)
      const color = RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)]
      const res = await window.api.createTag({ name, color })
      if (res.success && res.data) {
        await handleAddTag(res.data)
      }
    } catch (err) {
      console.error('Failed to create tag:', err)
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && search.trim()) {
      if (!exactMatch) {
        void handleCreateTag()
      } else if (filtered.length > 0) {
        void handleAddTag(filtered[0])
      }
    }
  }

  return (
    <div className={styles.tagManager}>
      {/* Current tags */}
      {currentTags.length > 0 && (
        <div className={styles.currentTags}>
          {currentTags.map((tag) => (
            <span
              key={tag.id}
              className={styles.tagPillColored}
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
                border: `1px solid ${tag.color}40`,
              }}
            >
              {tag.name}
              <span className={styles.tagRemove} onClick={() => void handleRemoveTag(tag.id)}>✕</span>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className={styles.tagSearch}>
        <input
          className={styles.searchInput}
          placeholder="搜索或创建标签..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Suggestions */}
      {search.trim() && (
        <div className={styles.suggestions}>
          {filtered.map((tag) => (
            <div
              key={tag.id}
              className={styles.suggestionItem}
              onClick={() => void handleAddTag(tag)}
            >
              <span className={styles.suggestionDot} style={{ backgroundColor: tag.color }} />
              {tag.name}
            </div>
          ))}
          {!exactMatch && search.trim() && (
            <div
              className={`${styles.suggestionItem} ${styles.createNew}`}
              onClick={() => void handleCreateTag()}
            >
              + 创建标签 &quot;{search.trim()}&quot;
            </div>
          )}
          {filtered.length === 0 && exactMatch && (
            <div className={styles.emptyHint}>没有更多匹配的标签</div>
          )}
        </div>
      )}
    </div>
  )
}
