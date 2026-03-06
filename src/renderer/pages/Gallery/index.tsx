import type { EntryListItem, EntrySortBy, EntrySortOrder } from '@shared/types/entry'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImportModal } from '../../components/entry/ImportModal'
import styles from './Gallery.module.css'

type FilterType = 'all' | 'NAI' | 'SD' | 'ComfyUI'

const TYPE_BADGE_CLASS: Record<string, string> = {
  NAI: styles.nai,
  SD: styles.sd,
  ComfyUI: styles.comfyui,
}

const PAGE_SIZE = 40

export function Gallery() {
  const navigate = useNavigate()
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  // Data state
  const [entries, setEntries] = useState<EntryListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [sortBy, setSortBy] = useState<EntrySortBy>('created_at')
  const [sortOrder, setSortOrder] = useState<EntrySortOrder>('desc')

  const api = window.api

  // Fetch entries from DB
  const fetchEntries = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await api.listEntries({
        page,
        pageSize: PAGE_SIZE,
        sortBy,
        sortOrder,
      })
      if (res.success && res.data) {
        setEntries(res.data.items)
        setTotal(res.data.total)
        setTotalPages(res.data.totalPages)
      }
    } catch (err) {
      console.error('Failed to load entries:', err)
    } finally {
      setIsLoading(false)
    }
  }, [api, page, sortBy, sortOrder])

  useEffect(() => {
    void fetchEntries()
  }, [fetchEntries])

  // Client-side filtering (type + keyword)
  const filteredEntries = useMemo(() => {
    let result = entries

    if (activeFilter !== 'all') {
      result = result.filter((e) => e.type === activeFilter)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (e) =>
          e.displayTitle.toLowerCase().includes(q) ||
          (e.authorName ?? e.authorId ?? '').toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q)),
      )
    }

    return result
  }, [entries, activeFilter, searchQuery])

  const handleImportSuccess = () => {
    void fetchEntries()
  }

  const handleCardClick = (entryId: string) => {
    void navigate(`/entry/${entryId}`)
  }

  const handleToggleFavorite = async (e: React.MouseEvent, entry: EntryListItem) => {
    e.stopPropagation()
    try {
      const res = await api.updateEntry({
        id: entry.id,
        isFavorited: !entry.isFavorited,
      })
      if (res.success) {
        setEntries((prev) =>
          prev.map((item) =>
            item.id === entry.id ? { ...item, isFavorited: !item.isFavorited } : item,
          ),
        )
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err)
    }
  }

  const handleSoftDelete = async (e: React.MouseEvent, entryId: string) => {
    e.stopPropagation()
    try {
      const res = await api.deleteEntry({ id: entryId, mode: 'soft' })
      if (res.success) {
        setEntries((prev) => prev.filter((item) => item.id !== entryId))
        setTotal((prev) => prev - 1)
      }
    } catch (err) {
      console.error('Failed to delete entry:', err)
    }
  }

  return (
    <div className={styles.galleryPage}>
      <header className={styles.header}>
        <h1 className={styles.title}>图库浏览</h1>
        <div className={styles.actions}>
          <input
            type="text"
            placeholder="搜索提示词、标签、作者..."
            className={styles.searchBar}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            className={styles.importBtn}
            onClick={() => setIsImportModalOpen(true)}
          >
            <span>+</span>
            <span>导入 / 抓取</span>
          </button>
        </div>
      </header>

      {/* Filter & sort bar */}
      <div className={styles.filterBar}>
        <span className={styles.filterLabel}>类型:</span>
        {(['all', 'NAI', 'SD', 'ComfyUI'] as FilterType[]).map((f) => (
          <button
            key={f}
            className={`${styles.filterChip} ${activeFilter === f ? styles.filterChipActive : ''}`}
            onClick={() => setActiveFilter(f)}
          >
            {f === 'all' ? '全部' : f}
          </button>
        ))}

        <span style={{ marginLeft: 'auto' }} />

        <span className={styles.filterLabel}>排序:</span>
        <select
          className={styles.filterChip}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as EntrySortBy)}
        >
          <option value="created_at">导入时间</option>
          <option value="post_date">发布时间</option>
          <option value="bookmarks">收藏数</option>
          <option value="views">浏览量</option>
        </select>
        <button
          className={styles.filterChip}
          onClick={() => setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
        >
          {sortOrder === 'desc' ? '↓ 降序' : '↑ 升序'}
        </button>
      </div>

      {/* Result count */}
      {total > 0 && (
        <div className={styles.resultCount}>
          共 {filteredEntries.length} / {total} 条记录
          {totalPages > 1 && ` · 第 ${page} / ${totalPages} 页`}
        </div>
      )}

      {isLoading ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⏳</div>
          <p>加载中...</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🖼️</div>
          <h2>{total === 0 ? '图库是空的' : '没有匹配的结果'}</h2>
          <p>
            {total === 0
              ? '点击右上角的导入按钮，添加您的第一条提示词或作品'
              : '尝试调整搜索词或筛选条件'}
          </p>
        </div>
      ) : (
        <>
          <div className={styles.masonryGrid}>
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className={styles.masonryItem}
                onClick={() => handleCardClick(entry.id)}
              >
                {entry.coverImage?.localPath ? (
                  <img
                    className={styles.masonryImage}
                    src={`file://${entry.coverImage.localPath}`}
                    alt={entry.displayTitle}
                    loading="lazy"
                  />
                ) : entry.coverImage?.originalUrl ? (
                  <img
                    className={styles.masonryImage}
                    src={entry.coverImage.originalUrl}
                    alt={entry.displayTitle}
                    loading="lazy"
                  />
                ) : (
                  <div className={styles.masonryImagePlaceholder}>
                    <span>🖼️</span>
                    <span style={{ fontSize: '11px' }}>{entry.imageCount} 张图片</span>
                  </div>
                )}
                <div className={styles.masonryInfo}>
                  <div className={styles.masonryTitleRow}>
                    <p className={styles.masonryTitle}>{entry.displayTitle}</p>
                    <button
                      className={`${styles.favBtn} ${entry.isFavorited ? styles.favActive : ''}`}
                      onClick={(e) => void handleToggleFavorite(e, entry)}
                      title={entry.isFavorited ? '取消收藏' : '加入收藏'}
                    >
                      {entry.isFavorited ? '❤️' : '🤍'}
                    </button>
                  </div>
                  <div className={styles.masonryMeta}>
                    <span className={`${styles.typeBadge} ${TYPE_BADGE_CLASS[entry.type] ?? ''}`}>
                      {entry.type}
                    </span>
                    {entry.authorName && <span>{entry.authorName}</span>}
                    {entry.imageCount > 1 && <span>📷 {entry.imageCount}</span>}
                  </div>
                  <div className={styles.masonryActions}>
                    <button
                      className={styles.deleteBtn}
                      onClick={(e) => void handleSoftDelete(e, entry.id)}
                      title="删除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← 上一页
              </button>
              <span className={styles.pageInfo}>{page} / {totalPages}</span>
              <button
                className={styles.pageBtn}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                下一页 →
              </button>
            </div>
          )}
        </>
      )}

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={handleImportSuccess}
      />
    </div>
  )
}
