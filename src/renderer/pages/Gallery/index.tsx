import type {
  EntryFilterType,
  EntryListItem,
  EntrySearchMode,
  EntrySortBy,
  EntrySortOrder,
} from '@shared/types/entry'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ImportModal } from '../../components/entry/ImportModal'
import { toImageSrc } from '../../utils/image-src'
import styles from './Gallery.module.css'

const TYPE_BADGE_CLASS: Record<string, string> = {
  NAI: styles.nai,
  SD: styles.sd,
  ComfyUI: styles.comfyui,
}

const PAGE_SIZE = 40
const FILTER_OPTIONS: EntryFilterType[] = ['all', 'NAI', 'SD', 'ComfyUI']
const SORT_OPTIONS: Array<{ value: EntrySortBy; label: string }> = [
  { value: 'created_at', label: '导入时间' },
  { value: 'post_date', label: '发布时间' },
  { value: 'bookmarks', label: '收藏数' },
  { value: 'views', label: '浏览量' },
]
const SEARCH_MODE_LABEL: Record<EntrySearchMode, string> = {
  basic: '基础搜索',
  metadata: '元数据搜索',
}

function normalizeFilter(value: string | null): EntryFilterType {
  return FILTER_OPTIONS.includes((value ?? 'all') as EntryFilterType)
    ? (value as EntryFilterType)
    : 'all'
}

function normalizeSortBy(value: string | null): EntrySortBy {
  return SORT_OPTIONS.some((option) => option.value === value)
    ? (value as EntrySortBy)
    : 'created_at'
}

function normalizeSortOrder(value: string | null): EntrySortOrder {
  return value === 'asc' ? 'asc' : 'desc'
}

function normalizeSearchMode(value: string | null): EntrySearchMode {
  return value === 'metadata' ? 'metadata' : 'basic'
}

export function Gallery() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  const [entries, setEntries] = useState<EntryListItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  const activeFilter = normalizeFilter(searchParams.get('type'))
  const sortBy = normalizeSortBy(searchParams.get('sortBy'))
  const sortOrder = normalizeSortOrder(searchParams.get('sortOrder'))
  const searchMode = normalizeSearchMode(searchParams.get('mode'))
  const appliedQuery = searchParams.get('q')?.trim() ?? ''
  const currentPage = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)

  const [basicQueryDraft, setBasicQueryDraft] = useState(searchMode === 'basic' ? appliedQuery : '')
  const [metadataQueryDraft, setMetadataQueryDraft] = useState(searchMode === 'metadata' ? appliedQuery : '')
  const [showMissingLoraOnly, setShowMissingLoraOnly] = useState(false)
  const [missingLoraIds, setMissingLoraIds] = useState<Set<string>>(new Set())
  const [isCheckingMissingLoras, setIsCheckingMissingLoras] = useState(false)

  const api = window.api

  useEffect(() => {
    if (searchMode === 'metadata') {
      setMetadataQueryDraft(appliedQuery)
      setBasicQueryDraft('')
      return
    }

    setBasicQueryDraft(appliedQuery)
    setMetadataQueryDraft('')
  }, [appliedQuery, searchMode])

  const updateParams = useCallback((next: Partial<Record<'mode' | 'q' | 'type' | 'sortBy' | 'sortOrder' | 'page', string>>) => {
    const params = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(next)) {
      if (!value) {
        params.delete(key)
        continue
      }

      params.set(key, value)
    }

    setSearchParams(params, { replace: true })
  }, [searchParams, setSearchParams])

  const fetchEntries = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await api.listEntries({
        page: currentPage,
        pageSize: PAGE_SIZE,
        sortBy,
        sortOrder,
        type: activeFilter,
        searchMode: appliedQuery ? searchMode : undefined,
        searchQuery: appliedQuery || undefined,
      })

      if (res.success && res.data) {
        setEntries(res.data.items)
        setTotal(res.data.total)
        setTotalPages(Math.max(1, res.data.totalPages))
      }
    } catch (err) {
      console.error('Failed to load entries:', err)
    } finally {
      setIsLoading(false)
    }
  }, [activeFilter, api, appliedQuery, currentPage, searchMode, sortBy, sortOrder])

  useEffect(() => {
    void fetchEntries()
  }, [fetchEntries])

  useEffect(() => {
    if (!showMissingLoraOnly || entries.length === 0) {
      setMissingLoraIds(new Set())
      return
    }

    let cancelled = false

    async function loadMissingLoraFlags() {
      try {
        setIsCheckingMissingLoras(true)
        const details = await Promise.all(entries.map(async (entry) => {
          const res = await api.getEntry(entry.id)
          return res.success ? res.data : null
        }))

        if (cancelled) {
          return
        }

        const nextIds = new Set(
          details
            .filter((detail) => detail?.remoteLoraCheck?.isScanned)
            .filter((detail) => detail?.remoteLoraCheck?.items.some((item) => item.exists === false))
            .map((detail) => detail?.id)
            .filter((detailId): detailId is string => typeof detailId === 'string'),
        )

        setMissingLoraIds(nextIds)
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to check missing remote LoRAs:', err)
        }
      } finally {
        if (!cancelled) {
          setIsCheckingMissingLoras(false)
        }
      }
    }

    void loadMissingLoraFlags()

    return () => {
      cancelled = true
    }
  }, [api, entries, showMissingLoraOnly])

  const filteredEntries = useMemo(() => {
    if (!showMissingLoraOnly) {
      return entries
    }

    return entries.filter((entry) => missingLoraIds.has(entry.id))
  }, [entries, missingLoraIds, showMissingLoraOnly])

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
        setEntries((prev) => prev.map((item) => (
          item.id === entry.id ? { ...item, isFavorited: !item.isFavorited } : item
        )))
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
        await fetchEntries()
      }
    } catch (err) {
      console.error('Failed to delete entry:', err)
    }
  }

  const handleSearchSubmit = () => {
    const nextMode: EntrySearchMode = metadataQueryDraft.trim() ? 'metadata' : 'basic'
    const nextQuery = nextMode === 'metadata' ? metadataQueryDraft.trim() : basicQueryDraft.trim()

    updateParams({
      mode: nextMode,
      page: '1',
      q: nextQuery || '',
      sortBy,
      sortOrder,
      type: activeFilter,
    })
  }

  const handleFilterChange = (nextFilter: EntryFilterType) => {
    updateParams({
      type: nextFilter,
      page: '1',
      mode: searchMode,
      q: appliedQuery || '',
      sortBy,
      sortOrder,
    })
  }

  const handleSortByChange = (nextSortBy: EntrySortBy) => {
    updateParams({
      sortBy: nextSortBy,
      sortOrder,
      type: activeFilter,
      page: '1',
      mode: searchMode,
      q: appliedQuery || '',
    })
  }

  const handleSortOrderToggle = () => {
    updateParams({
      sortBy,
      sortOrder: sortOrder === 'desc' ? 'asc' : 'desc',
      type: activeFilter,
      page: '1',
      mode: searchMode,
      q: appliedQuery || '',
    })
  }

  const handlePageChange = (nextPage: number) => {
    updateParams({
      page: String(nextPage),
      sortBy,
      sortOrder,
      type: activeFilter,
      mode: searchMode,
      q: appliedQuery || '',
    })
  }

  const handleClearSearch = () => {
    setBasicQueryDraft('')
    setMetadataQueryDraft('')
    updateParams({
      q: '',
      page: '1',
      mode: 'basic',
      sortBy,
      sortOrder,
      type: activeFilter,
    })
  }

  return (
    <div className={styles.galleryPage}>
      <header className={styles.header}>
        <div className={styles.headerTitleBlock}>
          <h1 className={styles.title}>图库浏览</h1>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.importBtn} onClick={() => setIsImportModalOpen(true)}>
            <span>＋</span>
            <span>导入 / 抓取</span>
          </button>
        </div>
      </header>

      <section className={styles.searchPanel}>
        <div className={styles.searchGrid}>
          <label className={styles.searchField}>
            <span className={styles.searchLabel}>基础搜索</span>
            <input
              type="text"
              placeholder="搜索作品、作者、简介、原站标签、用户标签..."
              className={styles.searchBar}
              value={basicQueryDraft}
              onChange={(e) => {
                setBasicQueryDraft(e.target.value)
                if (e.target.value) {
                  setMetadataQueryDraft('')
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearchSubmit()
                }
              }}
            />
          </label>

          <label className={styles.searchField}>
            <span className={styles.searchLabel}>元数据搜索</span>
            <input
              type="text"
              placeholder="搜索 Prompt / workflow / model / lora 关键词..."
              className={styles.searchBar}
              value={metadataQueryDraft}
              onChange={(e) => {
                setMetadataQueryDraft(e.target.value)
                if (e.target.value) {
                  setBasicQueryDraft('')
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearchSubmit()
                }
              }}
            />
          </label>

          <div className={styles.searchActionColumn}>
            <div className={styles.searchModeBadge}>{SEARCH_MODE_LABEL[searchMode]}</div>
            <div className={styles.searchButtons}>
              <button className={styles.searchBtn} onClick={handleSearchSubmit}>搜索</button>
              {(basicQueryDraft || metadataQueryDraft || appliedQuery) && (
                <button className={styles.clearBtn} onClick={handleClearSearch}>清空</button>
              )}
            </div>
          </div>
        </div>

        <div className={styles.filterBar}>
          <div className={styles.filterCluster}>
            <span className={styles.filterLabel}>类型</span>
            {FILTER_OPTIONS.map((filter) => (
              <button
                key={filter}
                className={`${styles.filterChip} ${activeFilter === filter ? styles.filterChipActive : ''}`}
                onClick={() => handleFilterChange(filter)}
              >
                {filter === 'all' ? '全部' : filter}
              </button>
            ))}
          </div>

          <div className={styles.filterCluster}>
            <span className={styles.filterLabel}>排序</span>
            <select
              className={styles.filterSelect}
              value={sortBy}
              onChange={(e) => handleSortByChange(e.target.value as EntrySortBy)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button className={styles.filterChip} onClick={handleSortOrderToggle}>
              {sortOrder === 'desc' ? '↓ 降序' : '↑ 升序'}
            </button>
            <button
              className={`${styles.filterChip} ${showMissingLoraOnly ? styles.filterChipActive : ''}`}
              onClick={() => setShowMissingLoraOnly((prev) => !prev)}
            >
              缺失 LoRA
            </button>
          </div>
        </div>
      </section>

      {(total > 0 || appliedQuery || showMissingLoraOnly) && (
        <div className={styles.resultCount}>
          共 {filteredEntries.length} / {total} 条记录
          {appliedQuery && ` · 当前模式：${SEARCH_MODE_LABEL[searchMode]} · 关键词：${appliedQuery}`}
          {totalPages > 1 && ` · 第 ${currentPage} / ${totalPages} 页`}
          {showMissingLoraOnly && (isCheckingMissingLoras ? ' · 正在检查远端 LoRA...' : ' · 仅显示当前页缺失 LoRA')}
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
              : '尝试调整搜索词、筛选条件或切换搜索模式'}
          </p>
        </div>
      ) : (
        <>
          <div className={styles.masonryGrid}>
            {filteredEntries.map((entry) => {
              const coverSrc = toImageSrc(entry.coverImage)

              return (
                <div key={entry.id} className={styles.masonryItem} onClick={() => handleCardClick(entry.id)}>
                  {coverSrc ? (
                    <div className={styles.imageFrame}>
                      <img className={styles.masonryImage} src={coverSrc} alt={entry.displayTitle} loading="lazy" />
                      <div className={styles.cardOverlay}>
                        <span className={`${styles.typeBadge} ${TYPE_BADGE_CLASS[entry.type] ?? ''}`}>{entry.type}</span>
                        {entry.imageCount > 1 && <span className={styles.imageBadge}>{entry.imageCount}</span>}
                      </div>
                    </div>
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
                        onClick={(event) => void handleToggleFavorite(event, entry)}
                        title={entry.isFavorited ? '取消收藏' : '加入收藏'}
                      >
                        {entry.isFavorited ? '❤️' : '🤍'}
                      </button>
                    </div>
                    <div className={styles.masonryMeta}>
                      {entry.authorName && <span>{entry.authorName}</span>}
                      <span>👁 {entry.views.toLocaleString()}</span>
                      <span>❤️ {entry.bookmarks.toLocaleString()}</span>
                    </div>
                    <div className={styles.tagPreview}>
                      {entry.tags.slice(0, 2).map((tag) => (
                        <span key={`${entry.id}-${tag}`} className={styles.previewTag}>{tag}</span>
                      ))}
                      {entry.userTags.slice(0, Math.max(0, 2 - Math.min(2, entry.tags.length))).map((tag) => (
                        <span key={`${entry.id}-user-${tag}`} className={styles.previewTagAlt}>{tag}</span>
                      ))}
                    </div>
                    <div className={styles.masonryActions}>
                      <button className={styles.deleteBtn} onClick={(event) => void handleSoftDelete(event, entry.id)} title="删除">
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                disabled={currentPage <= 1}
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              >
                ← 上一页
              </button>
              <span className={styles.pageInfo}>{currentPage} / {totalPages}</span>
              <button
                className={styles.pageBtn}
                disabled={currentPage >= totalPages}
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
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

