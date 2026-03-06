import type { EntryListItem } from '@shared/types/entry'
import type { UserTag } from '@shared/types/tag'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Collection.module.css'

export function Collection() {
  const navigate = useNavigate()
  const [tags, setTags] = useState<UserTag[]>([])
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const [favOnly, setFavOnly] = useState(false)
  const [entries, setEntries] = useState<EntryListItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Load all tags
  const loadTags = useCallback(async () => {
    try {
      const res = await window.api.listTags()
      if (res.success && res.data) {
        setTags(res.data)
      }
    } catch (err) {
      console.error('Failed to load tags:', err)
    }
  }, [])

  useEffect(() => {
    void loadTags()
  }, [loadTags])

  // Load entries (filtered by fav if needed — tag filtering will be done client side for now)
  const loadEntries = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await window.api.listEntries({
        page: 1,
        pageSize: 200,
        sortBy: 'created_at',
        sortOrder: 'desc',
      })
      if (res.success && res.data) {
        setEntries(res.data.items)
      }
    } catch (err) {
      console.error('Failed to load entries:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  // Client-side filtering
  const filteredEntries = entries.filter((entry) => {
    if (favOnly && !entry.isFavorited) return false
    if (selectedTagId) {
      // Check if entry's userTags array contains the selected tag name
      const selectedTag = tags.find((t) => t.id === selectedTagId)
      if (selectedTag && (!entry.userTags || !entry.userTags.includes(selectedTag.name))) return false
    }
    return true
  })

  const handleToggleTag = (tagId: string) => {
    setSelectedTagId((prev) => (prev === tagId ? null : tagId))
  }

  return (
    <div className={styles.collectionPage}>
      {/* Left: Tag Cloud */}
      <aside className={styles.tagCloudPanel}>
        <h2 className={styles.panelTitle}>🏷️ 标签云</h2>

        <div
          className={`${styles.filterToggle} ${favOnly ? styles.active : ''}`}
          onClick={() => setFavOnly(!favOnly)}
        >
          {favOnly ? '❤️ 只看收藏' : '🤍 全部条目'}
        </div>

        <div className={styles.tagCloud}>
          {tags.map((tag) => (
            <span
              key={tag.id}
              className={`${styles.cloudTag} ${tag.id === selectedTagId ? styles.selected : ''}`}
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
                border: `1px solid ${tag.color}40`,
                fontSize: `${Math.max(12, Math.min(22, 14))}px`,
              }}
              onClick={() => handleToggleTag(tag.id)}
            >
              {tag.name}
            </span>
          ))}
          {tags.length === 0 && (
            <div className={styles.emptyState} style={{ padding: 'var(--space-4)' }}>
              <div>还没有创建标签</div>
              <div style={{ fontSize: '12px' }}>在详情页为作品打标后，标签会出现在这里</div>
            </div>
          )}
        </div>

        {selectedTagId && (
          <button className={styles.clearFilter} onClick={() => setSelectedTagId(null)}>
            ✕ 清除标签筛选
          </button>
        )}
      </aside>

      {/* Right: Filtered entries */}
      <main className={styles.resultsPanel}>
        <div className={styles.resultsMeta}>
          {isLoading ? '加载中...' : `共 ${filteredEntries.length} 条结果`}
          {selectedTagId && ` · 标签: ${tags.find((t) => t.id === selectedTagId)?.name ?? ''}`}
          {favOnly && ' · 仅收藏'}
        </div>

        {filteredEntries.length > 0 ? (
          <div className={styles.resultsGrid}>
            {filteredEntries.map((entry) => {
              const coverSrc = entry.coverImage?.localPath
                ? `file://${entry.coverImage.localPath}`
                : entry.coverImage?.originalUrl

              return (
                <div
                  key={entry.id}
                  className={styles.resultCard}
                  onClick={() => void navigate(`/entry/${entry.id}`)}
                >
                  {coverSrc ? (
                    <img src={coverSrc} alt={entry.displayTitle} className={styles.resultImg} loading="lazy" />
                  ) : (
                    <div className={styles.resultImg} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: 'var(--text-muted)' }}>
                      🖼️
                    </div>
                  )}
                  <div className={styles.resultInfo}>
                    <div className={styles.resultTitle}>
                      {entry.isFavorited ? '❤️ ' : ''}{entry.displayTitle}
                    </div>
                    <div className={styles.resultType}>{entry.type} · {entry.imageCount} 张</div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>{favOnly ? '💔' : '🏷️'}</div>
            <p>{favOnly ? '还没有收藏任何条目' : selectedTagId ? '没有匹配该标签的条目' : '暂无条目'}</p>
          </div>
        )}
      </main>
    </div>
  )
}
