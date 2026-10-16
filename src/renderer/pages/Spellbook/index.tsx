import type {
  SpellbookCategory,
  SpellbookEntryDetail,
  SpellbookEntrySummary,
  SpellbookLibraryStatus,
} from '@shared/types/spellbook'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { toImageSrc } from '@renderer/utils/image-src'
import { buildTestingSearch } from '@renderer/utils/testing-route'

import styles from './Spellbook.module.css'

const CATEGORY_OPTIONS: Array<{ value: SpellbookCategory | null; label: string }> = [
  { value: null, label: '全部' },
  { value: 'style_prompt', label: '画风串' },
  { value: 'tool_nav', label: '工具导航' },
  { value: 'tag_reference', label: '标签参考' },
]

function formatNumber(value: number): string {
  return value.toLocaleString('zh-CN')
}

function categoryLabel(value: SpellbookCategory): string {
  return CATEGORY_OPTIONS.find((item) => item.value === value)?.label ?? value
}

export function Spellbook() {
  const navigate = useNavigate()

  const [status, setStatus] = useState<SpellbookLibraryStatus | null>(null)
  const [entries, setEntries] = useState<SpellbookEntrySummary[]>([])
  const [selectedEntryId, setSelectedEntryId] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<SpellbookEntryDetail | null>(null)
  const [searchDraft, setSearchDraft] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [category, setCategory] = useState<SpellbookCategory | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isBooting, setIsBooting] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  const loadStatus = useCallback(async () => {
    const res = await window.api.getSpellbookStatus()
    if (!res.success || !res.data) {
      throw new Error(res.error?.message ?? '法典库状态读取失败。')
    }
    setStatus(res.data)
    return res.data
  }, [])

  const loadEntries = useCallback(async () => {
    const res = await window.api.listSpellbookEntries({
      category,
      searchQuery: appliedSearch || undefined,
      includeChildren: Boolean(appliedSearch.trim()),
      sortBy: 'title',
      sortOrder: 'asc',
    })
    if (!res.success || !res.data) {
      throw new Error(res.error?.message ?? '法典条目加载失败。')
    }
    const nextEntries = res.data
    setEntries(nextEntries)
    setSelectedEntryId((current) => current || nextEntries[0]?.id || '')
  }, [appliedSearch, category])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        setError('')
        await loadStatus()
        if (cancelled) return
        await loadEntries()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) {
          setIsBooting(false)
        }
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [loadEntries, loadStatus])

  useEffect(() => {
    if (!status?.synced && !status?.totalEntries) {
      return
    }

    let cancelled = false
    async function refreshEntries() {
      try {
        setError('')
        await loadEntries()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      }
    }

    void refreshEntries()
    return () => {
      cancelled = true
    }
  }, [loadEntries, status?.synced, status?.totalEntries])

  useEffect(() => {
    if (!selectedEntryId) {
      setSelectedEntry(null)
      return
    }

    let cancelled = false
    async function loadDetail() {
      try {
        setIsLoadingDetail(true)
        const res = await window.api.getSpellbookEntry(selectedEntryId)
        if (cancelled) return
        if (!res.success) {
          setError(res.error?.message ?? '法典详情加载失败。')
          return
        }
        setSelectedEntry(res.data ?? null)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDetail(false)
        }
      }
    }

    void loadDetail()
    return () => {
      cancelled = true
    }
  }, [selectedEntryId])

  const topLevelCounts = useMemo(() => ({
    stylePrompt: status?.entryCounts.stylePrompt ?? 0,
    toolNav: status?.entryCounts.toolNav ?? 0,
    tagReference: status?.entryCounts.tagReference ?? 0,
  }), [status])

  const handleSync = async () => {
    try {
      setIsSyncing(true)
      setError('')
      setNotice('')
      const res = await window.api.syncSpellbookLibrary()
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? '法典库同步失败。')
      }
      await Promise.all([loadStatus(), loadEntries()])
      setNotice(`已同步 ${formatNumber(res.data.totalEntries)} 条法典资源，缓存 ${formatNumber(res.data.totalImages)} 张图片。`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSyncing(false)
    }
  }

  const handleCopyPrompt = async () => {
    if (!selectedEntry?.promptText?.trim()) {
      setError('当前条目没有可复制的提示词。')
      return
    }
    await navigator.clipboard.writeText(selectedEntry.promptText)
    setNotice(`已复制法典条目「${selectedEntry.title}」的提示词。`)
  }

  const handleSendToTesting = (mode: 'comfy' | 'nai') => {
    if (!selectedEntry) {
      return
    }
    void navigate(`/testing${buildTestingSearch({
      mode,
      promptSource: 'spellbook',
      spellbookEntryId: selectedEntry.id,
    })}`)
  }

  if (isBooting) {
    return <div className={styles.stateShell}>⏳ 正在加载法典库...</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>法典库</h1>
          <p className={styles.subtitle}>
            从 `nai4.top` 抓取并缓存法典目录中的画风串、工具导航和标签参考。法典内的提示词片段与示例图优先使用本地缓存，不依赖运行时外链。
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.primaryBtn} onClick={() => void handleSync()} disabled={isSyncing}>
            {isSyncing ? '同步中...' : '同步法典库'}
          </button>
        </div>
      </header>

      <section className={styles.toolbar}>
        <label className={styles.field}>
          <span>搜索</span>
          <input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="搜索标题、摘要、提示词或正文片段..."
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                setAppliedSearch(searchDraft.trim())
              }
            }}
          />
        </label>

        <div className={styles.segmentGroup}>
          {CATEGORY_OPTIONS.map((option) => (
            <button
              key={option.label}
              className={category === option.value ? styles.segmentActive : styles.segment}
              onClick={() => setCategory(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className={styles.inlineActions}>
          <button className={styles.secondaryBtn} onClick={() => setAppliedSearch(searchDraft.trim())}>搜索</button>
          <button className={styles.secondaryBtn} onClick={() => { setSearchDraft(''); setAppliedSearch('') }}>清空</button>
        </div>
      </section>

      <section className={styles.statsRow}>
        <div className={styles.statCard}><span>总条目</span><strong>{formatNumber(status?.totalEntries ?? 0)}</strong></div>
        <div className={styles.statCard}><span>本地图片</span><strong>{formatNumber(status?.totalImages ?? 0)}</strong></div>
        <div className={styles.statCard}><span>画风串</span><strong>{formatNumber(topLevelCounts.stylePrompt)}</strong></div>
        <div className={styles.statCard}><span>工具/标签</span><strong>{formatNumber(topLevelCounts.toolNav + topLevelCounts.tagReference)}</strong></div>
      </section>

      {(notice || error) && (
        <div className={notice ? styles.noticeBox : styles.errorBox}>{notice || error}</div>
      )}

      {!status?.synced && (status?.totalEntries ?? 0) === 0 ? (
        <section className={styles.emptyCard}>
          <div className={styles.emptyShell}>
            <div>
              <h2>法典库尚未同步</h2>
              <p className={styles.muted}>先同步一次目录与法典正文，本页才会显示可搜索的本地缓存条目。</p>
            </div>
          </div>
        </section>
      ) : (
        <section className={styles.layout}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarCard}>
              <div className={styles.sectionTitleRow}>
                <h2>条目列表</h2>
                <span className={styles.muted}>{entries.length} 条</span>
              </div>
              <div className={styles.entryList}>
                {entries.length === 0 ? (
                  <div className={styles.muted}>当前筛选下没有条目。</div>
                ) : entries.map((entry) => (
                  <button
                    key={entry.id}
                    className={selectedEntryId === entry.id ? styles.entryButtonActive : styles.entryButton}
                    onClick={() => setSelectedEntryId(entry.id)}
                  >
                    <span className={styles.entryTitle}>{entry.title}</span>
                    <span className={styles.entryMeta}>
                      {categoryLabel(entry.category)} · {entry.kind === 'external_link' ? '外部入口' : entry.kind === 'site_child_page' ? '子页' : '站内页'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className={styles.content}>
            {!selectedEntry ? (
              <div className={styles.stateShell}>选择一个法典条目查看详情。</div>
            ) : isLoadingDetail ? (
              <div className={styles.stateShell}>⏳ 正在加载法典详情...</div>
            ) : (
              <div className={styles.detailPanel}>
                <h2 className={styles.detailTitle}>{selectedEntry.title}</h2>
                <p className={styles.detailSummary}>{selectedEntry.summary || '当前条目暂无摘要。'}</p>

                <div className={styles.metaRow}>
                  <span className={styles.metaPill}>{categoryLabel(selectedEntry.category)}</span>
                  {selectedEntry.modelHints.map((hint) => (
                    <span key={hint} className={styles.metaPill}>{hint}</span>
                  ))}
                  {selectedEntry.tags.map((tag) => (
                    <span key={tag} className={styles.metaPill}>{tag}</span>
                  ))}
                </div>

                <div className={styles.detailActions}>
                  <button className={styles.secondaryBtn} onClick={() => void handleCopyPrompt()} disabled={!selectedEntry.promptText}>
                    复制提示词
                  </button>
                  <button className={styles.secondaryBtn} onClick={() => handleSendToTesting('nai')} disabled={!selectedEntry.promptText}>
                    送测 NAI
                  </button>
                  <button className={styles.secondaryBtn} onClick={() => handleSendToTesting('comfy')} disabled={!selectedEntry.promptText}>
                    送测 ComfyUI
                  </button>
                  <button className={styles.secondaryBtn} onClick={() => window.open(selectedEntry.sourceUrl, '_blank', 'noopener,noreferrer')}>
                    打开来源
                  </button>
                </div>

                <div className={styles.detailCard}>
                  <h3 className={styles.detailSectionTitle}>提取到的提示词</h3>
                  {selectedEntry.promptText ? (
                    <pre className={styles.promptBlock}>{selectedEntry.promptText}</pre>
                  ) : (
                    <div className={styles.muted}>当前条目还没有可直接送测的提示词片段。</div>
                  )}
                </div>

                {selectedEntry.images.length > 0 && (
                  <div className={styles.detailCard}>
                    <h3 className={styles.detailSectionTitle}>本地示例图</h3>
                    <div className={styles.imageGrid}>
                      {selectedEntry.images.map((image, index) => (
                        <div key={`${image.originalUrl}-${index}`} className={styles.imageCard}>
                          <img className={styles.image} src={toImageSrc({ localPath: image.localPath, originalUrl: image.originalUrl || '' }) ?? undefined} alt={image.caption ?? `${selectedEntry.title}-${index + 1}`} />
                          <div className={styles.imageCaption}>{image.caption || `示例图 #${index + 1}`}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedEntry.childEntries.length > 0 && (
                  <div className={styles.detailCard}>
                    <h3 className={styles.detailSectionTitle}>站内子页</h3>
                    <div className={styles.childrenList}>
                      {selectedEntry.childEntries.map((child) => (
                        <button key={child.id} className={styles.childButton} onClick={() => setSelectedEntryId(child.id)}>
                          {child.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedEntry.sections.length > 0 && (
                  <div className={styles.detailCard}>
                    <h3 className={styles.detailSectionTitle}>正文摘要</h3>
                    <div className={styles.sections}>
                      {selectedEntry.sections.slice(0, 8).map((section, index) => (
                        <div key={`${section.heading}-${index}`} className={styles.sectionCard}>
                          <h4 className={styles.sectionHeading}>{section.heading}</h4>
                          <div className={styles.sectionBlocks}>{section.blocks.slice(0, 6).join('\n\n')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedEntry.relatedLinks.length > 0 && (
                  <div className={styles.detailCard}>
                    <h3 className={styles.detailSectionTitle}>相关链接</h3>
                    <div className={styles.linkList}>
                      {selectedEntry.relatedLinks.slice(0, 20).map((link) => (
                        <button
                          key={`${link.url}-${link.title}`}
                          className={styles.linkPill}
                          onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                        >
                          {link.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
