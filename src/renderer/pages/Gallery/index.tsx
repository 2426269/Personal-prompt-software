import type { AitagImage } from '@shared/types/importer'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImportModal } from '../../components/entry/ImportModal'
import styles from './Gallery.module.css'

type FilterType = 'all' | 'NAI' | 'SD' | 'ComfyUI'

/** Temporary demo data until Phase 1B wires up real DB reads. */
interface GalleryEntry {
  id: string
  title: string
  type: 'NAI' | 'SD' | 'ComfyUI'
  tags: string[]
  author: string
  thumbnail: string | null
  createdAt: string
}

const TYPE_BADGE_CLASS: Record<string, string> = {
  NAI: styles.nai,
  SD: styles.sd,
  ComfyUI: styles.comfyui,
}

export function Gallery() {
  const navigate = useNavigate()
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  // Placeholder state — will be replaced by IPC call in Phase 1B
  const [entries] = useState<GalleryEntry[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_images] = useState<AitagImage[]>([])

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')

  // Filtered entries
  const filteredEntries = useMemo(() => {
    let result = entries

    // Type filter
    if (activeFilter !== 'all') {
      result = result.filter((e) => e.type === activeFilter)
    }

    // Keyword search: title, tags, author
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.author.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q)),
      )
    }

    return result
  }, [entries, activeFilter, searchQuery])

  const handleImportSuccess = (entryId: string) => {
    console.log('Successfully imported entry:', entryId)
    // TODO Phase 1B: refresh gallery list from DB via IPC
  }

  const handleCardClick = (entryId: string) => {
    void navigate(`/entry/${entryId}`)
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

      {/* Filter chips */}
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
      </div>

      {/* Result count */}
      {entries.length > 0 && (
        <div className={styles.resultCount}>
          共 {filteredEntries.length} / {entries.length} 条记录
        </div>
      )}

      {filteredEntries.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🖼️</div>
          <h2>{entries.length === 0 ? '图库是空的' : '没有匹配的结果'}</h2>
          <p>
            {entries.length === 0
              ? '点击右上角的导入按钮，添加您的第一条提示词或作品'
              : '尝试调整搜索词或筛选条件'}
          </p>
        </div>
      ) : (
        <div className={styles.masonryGrid}>
          {filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className={styles.masonryItem}
              onClick={() => handleCardClick(entry.id)}
            >
              {entry.thumbnail && (
                <img
                  className={styles.masonryImage}
                  src={entry.thumbnail}
                  alt={entry.title}
                  loading="lazy"
                />
              )}
              <div className={styles.masonryInfo}>
                <p className={styles.masonryTitle}>{entry.title}</p>
                <div className={styles.masonryMeta}>
                  <span className={`${styles.typeBadge} ${TYPE_BADGE_CLASS[entry.type] ?? ''}`}>
                    {entry.type}
                  </span>
                  <span>{entry.author}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={handleImportSuccess}
      />
    </div>
  )
}
