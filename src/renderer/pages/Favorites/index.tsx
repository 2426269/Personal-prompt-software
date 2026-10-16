import type { EntryListItem } from '@shared/types/entry'
import type { UserTag } from '@shared/types/tag'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { toImageSrc } from '@renderer/utils/image-src'

import styles from './Favorites.module.css'

interface FavoriteTagStat {
  name: string
  count: number
  color: string
}

function matchesSearch(entry: EntryListItem, query: string): boolean {
  if (!query) {
    return true
  }

  const haystack = [
    entry.displayTitle,
    entry.authorName,
    entry.caption,
    ...entry.tags,
    ...entry.userTags,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(query.toLowerCase())
}

const FAVORITES_PAGE_SIZE = 200

export function Favorites() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState<EntryListItem[]>([])
  const [tagPalette, setTagPalette] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setIsLoading(true)
        setError('')

        const [firstPageRes, tagsRes] = await Promise.all([
          window.api.listEntries({
            page: 1,
            pageSize: FAVORITES_PAGE_SIZE,
            sortBy: 'updated_at',
            sortOrder: 'desc',
            favoritesOnly: true,
          }),
          window.api.listTags(),
        ])

        if (cancelled) {
          return
        }

        if (!firstPageRes.success || !firstPageRes.data) {
          setError(firstPageRes.error?.message ?? '收藏列表加载失败。')
          return
        }

        let favoriteEntries = firstPageRes.data.items
        const totalPages = Math.max(1, firstPageRes.data.totalPages)

        if (totalPages > 1) {
          const remainingResponses = await Promise.all(
            Array.from({ length: totalPages - 1 }, (_unused, index) =>
              window.api.listEntries({
                page: index + 2,
                pageSize: FAVORITES_PAGE_SIZE,
                sortBy: 'updated_at',
                sortOrder: 'desc',
                favoritesOnly: true,
              }),
            ),
          )

          if (cancelled) {
            return
          }

          const failedResponse = remainingResponses.find((response) => !response.success || !response.data)
          if (failedResponse) {
            setError(failedResponse.error?.message ?? '收藏列表加载失败。')
            return
          }

          favoriteEntries = favoriteEntries.concat(
            remainingResponses.flatMap((response) => response.data?.items ?? []),
          )
        }

        setEntries(favoriteEntries)

        if (tagsRes.success && tagsRes.data) {
          setTagPalette(
            tagsRes.data.reduce<Record<string, string>>((accumulator, tag: UserTag) => {
              accumulator[tag.name] = tag.color
              return accumulator
            }, {}),
          )
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const favoriteTags = useMemo<FavoriteTagStat[]>(() => {
    const counts = new Map<string, number>()

    for (const entry of entries) {
      for (const tag of entry.userTags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }

    return [...counts.entries()]
      .map(([name, count]) => ({
        name,
        count,
        color: tagPalette[name] ?? '#7d8590',
      }))
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'zh-CN'))
  }, [entries, tagPalette])

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (selectedTag && !entry.userTags.includes(selectedTag)) {
        return false
      }

      return matchesSearch(entry, search.trim())
    })
  }, [entries, search, selectedTag])

  const totalImages = useMemo(
    () => entries.reduce((total, entry) => total + entry.imageCount, 0),
    [entries],
  )

  const handleToggleFavorite = async (entry: EntryListItem) => {
    const res = await window.api.updateEntry({
      id: entry.id,
      isFavorited: !entry.isFavorited,
    })

    if (res.success) {
      setEntries((prev) => prev.filter((item) => item.id !== entry.id))
    }
  }

  if (isLoading) {
    return <div className={styles.stateShell}>⏳ 正在加载收藏...</div>
  }

  if (error) {
    return <div className={styles.stateShell}>{error}</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>收藏</h1>
          <p className={styles.subtitle}>这里只保留真实收藏条目，标签筛选也只基于收藏结果本身。</p>
        </div>

        <div className={styles.statGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>收藏条目</span>
            <strong>{entries.length}</strong>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>关联图片</span>
            <strong>{totalImages}</strong>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>收藏标签</span>
            <strong>{favoriteTags.length}</strong>
          </div>
        </div>
      </header>

      <section className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarCard}>
            <label className={styles.searchLabel}>
              <span>搜索收藏</span>
              <input
                className={styles.searchInput}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="标题 / 作者 / 标签 / 简介"
              />
            </label>
          </div>

          <div className={styles.sidebarCard}>
            <div className={styles.sidebarTitleRow}>
              <h2 className={styles.sidebarTitle}>用户标签</h2>
              {selectedTag && (
                <button className={styles.clearButton} onClick={() => setSelectedTag(null)}>
                  清除
                </button>
              )}
            </div>

            {favoriteTags.length === 0 ? (
              <div className={styles.sidebarEmpty}>收藏条目还没有用户标签。</div>
            ) : (
              <div className={styles.tagCloud}>
                {favoriteTags.map((tag) => (
                  <button
                    key={tag.name}
                    className={`${styles.tagButton} ${selectedTag === tag.name ? styles.tagButtonActive : ''}`}
                    style={{
                      borderColor: `${tag.color}66`,
                      color: selectedTag === tag.name ? '#fff' : tag.color,
                      background: selectedTag === tag.name ? tag.color : `${tag.color}14`,
                    }}
                    onClick={() => setSelectedTag((current) => (current === tag.name ? null : tag.name))}
                  >
                    <span>{tag.name}</span>
                    <span className={styles.tagCount}>{tag.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <main className={styles.content}>
          <div className={styles.resultMeta}>
            共 {filteredEntries.length} 条收藏
            {selectedTag && ` · 标签：${selectedTag}`}
            {search.trim() && ` · 搜索：${search.trim()}`}
          </div>

          {filteredEntries.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>{entries.length === 0 ? '⭐' : '🔎'}</div>
              <h2>{entries.length === 0 ? '还没有收藏内容' : '没有匹配的收藏结果'}</h2>
              <p>
                {entries.length === 0
                  ? '在图库或详情页点亮收藏按钮后，这里才会出现条目。'
                  : '尝试清空标签或搜索条件。'}
              </p>
            </div>
          ) : (
            <div className={styles.grid}>
              {filteredEntries.map((entry) => {
                const coverSrc = toImageSrc(entry.coverImage)

                return (
                  <article key={entry.id} className={styles.card}>
                    <button className={styles.cardImageButton} onClick={() => void navigate(`/entry/${entry.id}`)}>
                      {coverSrc ? (
                        <img className={styles.cardImage} src={coverSrc} alt={entry.displayTitle} loading="lazy" />
                      ) : (
                        <div className={styles.cardPlaceholder}>🖼️</div>
                      )}
                      <div className={styles.cardBadgeRow}>
                        <span className={styles.typeBadge}>{entry.type}</span>
                        <span className={styles.countBadge}>{entry.imageCount} 张</span>
                      </div>
                    </button>

                    <div className={styles.cardBody}>
                      <div className={styles.cardTitleRow}>
                        <button className={styles.cardTitleButton} onClick={() => void navigate(`/entry/${entry.id}`)}>
                          {entry.displayTitle}
                        </button>
                        <button
                          className={styles.favoriteButton}
                          onClick={() => void handleToggleFavorite(entry)}
                          title="取消收藏"
                        >
                          ❤️
                        </button>
                      </div>

                      <div className={styles.cardMeta}>
                        {entry.authorName && <span>{entry.authorName}</span>}
                        <span>👁 {entry.views.toLocaleString()}</span>
                        <span>❤️ {entry.bookmarks.toLocaleString()}</span>
                      </div>

                      <div className={styles.tagRow}>
                        {entry.userTags.slice(0, 4).map((tag) => (
                          <button
                            key={`${entry.id}-${tag}`}
                            className={styles.userTag}
                            onClick={() => setSelectedTag(tag)}
                          >
                            {tag}
                          </button>
                        ))}
                        {entry.userTags.length === 0 && <span className={styles.noTag}>未打用户标签</span>}
                      </div>

                      {entry.caption && <p className={styles.caption}>{entry.caption}</p>}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </main>
      </section>
    </div>
  )
}
