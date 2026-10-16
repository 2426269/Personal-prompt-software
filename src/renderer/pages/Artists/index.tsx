import type {
  AnimaArtistDetail,
  AnimaArtistSortBy,
  AnimaArtistSummary,
  AnimaFolder,
  AnimaLibraryStatus,
} from '@shared/types/anima'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { toImageSrc } from '@renderer/utils/image-src'
import { buildTestingSearch } from '@renderer/utils/testing-route'

import styles from './Artists.module.css'

const DEFAULT_SOURCE_PATH = 'E:\\生图提示词积累\\Anima-Style-Explorer-main'
const PAGE_SIZE = 90

function formatNumber(value: number): string {
  return value.toLocaleString('zh-CN')
}

function formatScore(value: number | null): string {
  return value == null ? '未提供' : value.toFixed(2)
}

export function Artists() {
  const navigate = useNavigate()

  const [status, setStatus] = useState<AnimaLibraryStatus | null>(null)
  const [folders, setFolders] = useState<AnimaFolder[]>([])
  const [artists, setArtists] = useState<AnimaArtistSummary[]>([])
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null)
  const [selectedArtist, setSelectedArtist] = useState<AnimaArtistDetail | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchDraft, setSearchDraft] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [sortBy, setSortBy] = useState<AnimaArtistSortBy>('post_count')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [activeFolderId, setActiveFolderId] = useState('')
  const [sourcePathDraft, setSourcePathDraft] = useState(DEFAULT_SOURCE_PATH)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  const loadStatus = async () => {
    const res = await window.api.getAnimaLibraryStatus()
    if (!res.success || !res.data) {
      throw new Error(res.error?.message ?? '读取 Anima 状态失败。')
    }
    const nextStatus = res.data
    setStatus(nextStatus)
    setSourcePathDraft((current) => current || nextStatus.sourcePath || DEFAULT_SOURCE_PATH)
    return nextStatus
  }

  const loadFolders = async () => {
    const res = await window.api.listAnimaFolders()
    if (!res.success || !res.data) {
      throw new Error(res.error?.message ?? '读取文件夹失败。')
    }
    setFolders(res.data)
  }

  const loadArtists = async () => {
    setIsLoadingList(true)
    const res = await window.api.listAnimaArtists({
      page,
      pageSize: PAGE_SIZE,
      searchQuery: appliedSearch || undefined,
      sortBy,
      sortOrder,
      favoritesOnly,
      folderId: activeFolderId || undefined,
    })

    if (!res.success || !res.data) {
      throw new Error(res.error?.message ?? '读取画师列表失败。')
    }

    const nextList = res.data
    setArtists(nextList.items)
    setTotal(nextList.total)
    setTotalPages(nextList.totalPages)
    setSelectedArtistId((current) => current ?? nextList.items[0]?.id ?? null)
  }

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        setError('')
        const currentStatus = await loadStatus()
        if (cancelled) {
          return
        }
        await loadFolders()
        if (!currentStatus.imported || cancelled) {
          setArtists([])
          setSelectedArtistId(null)
          setTotal(0)
          setTotalPages(1)
          return
        }
        await loadArtists()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) {
          setIsLoadingList(false)
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!status?.imported) {
      return
    }

    let cancelled = false

    async function refreshList() {
      try {
        setError('')
        await loadArtists()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) {
          setIsLoadingList(false)
        }
      }
    }

    void refreshList()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.imported, page, appliedSearch, sortBy, sortOrder, favoritesOnly, activeFolderId])

  useEffect(() => {
    if (!selectedArtistId) {
      setSelectedArtist(null)
      return
    }

    let cancelled = false
    const currentArtistId = selectedArtistId

    async function loadDetail() {
      try {
        setIsLoadingDetail(true)
        const res = await window.api.getAnimaArtist(currentArtistId)
        if (cancelled) {
          return
        }
        if (!res.success) {
          setError(res.error?.message ?? '读取画师详情失败。')
          return
        }
        setSelectedArtist(res.data ?? null)
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
  }, [selectedArtistId])

  const selectedArtistsOnPage = useMemo(
    () => artists.filter((artist) => selectedIds.includes(artist.id)),
    [artists, selectedIds],
  )

  const handleImport = async () => {
    try {
      setIsImporting(true)
      setError('')
      setNotice('')
      const res = await window.api.importAnimaLibrary({ sourcePath: sourcePathDraft.trim() || undefined })
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? '导入失败。')
      }
      if (res.data.cancelled) {
        return
      }

      const [nextStatus] = await Promise.all([loadStatus(), loadFolders()])
      setNotice(`已导入 ${formatNumber(res.data.totalArtists)} 位画师到 ${nextStatus.libraryRootPath ?? '当前应用数据目录'}。`)
      setPage(1)
      await loadArtists()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsImporting(false)
      setIsLoadingList(false)
    }
  }

  const handleToggleFavorite = async (artist: AnimaArtistSummary, nextValue: boolean) => {
    const res = await window.api.toggleAnimaFavorite({
      artistId: artist.id,
      isFavorited: nextValue,
    })
    if (!res.success) {
      setError(res.error?.message ?? '收藏更新失败。')
      return
    }

    setArtists((prev) => prev.map((item) => (
      item.id === artist.id ? { ...item, isFavorited: nextValue } : item
    )))
    if (selectedArtist?.id === artist.id) {
      setSelectedArtist({ ...selectedArtist, isFavorited: nextValue })
    }
    void loadStatus()
  }

  const handleToggleSelected = (artistId: string) => {
    setSelectedIds((prev) => (
      prev.includes(artistId) ? prev.filter((id) => id !== artistId) : [...prev, artistId]
    ))
  }

  const handleCopy = async (artistNames: string[]) => {
    if (artistNames.length === 0) {
      return
    }
    await navigator.clipboard.writeText(artistNames.join(', '))
    setNotice(`已复制 ${artistNames.length} 个画师名。`)
  }

  const handleSendToTesting = (artistIds: string[], mode: 'comfy' | 'nai' = 'comfy') => {
    if (artistIds.length === 0) {
      setError('请先选择至少一个画师。')
      return
    }
    void navigate(`/testing${buildTestingSearch({
      mode,
      promptSource: 'anima',
      animaArtistIds: artistIds,
    })}`)
  }

  const handleExport = async (format: 'txt' | 'json') => {
    const res = await window.api.exportAnimaArtists({
      format,
      artistIds: selectedIds.length > 0 ? selectedIds : undefined,
      favoritesOnly: selectedIds.length === 0 ? favoritesOnly : false,
    })
    if (!res.success || !res.data) {
      setError(res.error?.message ?? '导出失败。')
      return
    }
    if (!res.data.cancelled) {
      setNotice(`已导出 ${res.data.artistCount} 位画师到 ${res.data.filePath}`)
    }
  }

  const handleImportFavorites = async () => {
    const res = await window.api.importAnimaFavorites()
    if (!res.success || !res.data) {
      setError(res.error?.message ?? '导入收藏失败。')
      return
    }
    if (!res.data.cancelled) {
      setNotice(`已导入 ${res.data.importedFavorites} 个收藏、${res.data.importedFolders} 个文件夹。`)
      await Promise.all([loadFolders(), loadArtists(), loadStatus()])
    }
  }

  const handleCreateFolder = async () => {
    const name = window.prompt('输入新文件夹名称')
    if (!name?.trim()) {
      return
    }
    const res = await window.api.saveAnimaFolder({ name: name.trim() })
    if (!res.success || !res.data) {
      setError(res.error?.message ?? '创建文件夹失败。')
      return
    }
    setNotice(`已创建文件夹「${res.data.name}」。`)
    await loadFolders()
  }

  const handleDeleteFolder = async (folder: AnimaFolder) => {
    if (!window.confirm(`确定删除文件夹「${folder.name}」吗？`)) {
      return
    }
    const res = await window.api.deleteAnimaFolder({ id: folder.id })
    if (!res.success) {
      setError(res.error?.message ?? '删除文件夹失败。')
      return
    }
    if (activeFolderId === folder.id) {
      setActiveFolderId('')
    }
    await loadFolders()
    await loadArtists()
  }

  const handleApplyCurrentFolderToSelection = async () => {
    if (!activeFolderId || selectedIds.length === 0) {
      return
    }

    for (const artistId of selectedIds) {
      const detailRes = await window.api.getAnimaArtist(artistId)
      if (!detailRes.success || !detailRes.data) {
        continue
      }
      const nextFolderIds = [...new Set([...detailRes.data.folderIds, activeFolderId])]
      await window.api.setAnimaArtistFolders({
        artistId,
        folderIds: nextFolderIds,
      })
    }

    setNotice(`已把 ${selectedIds.length} 位画师加入当前文件夹。`)
    await Promise.all([loadFolders(), loadArtists()])
  }

  const handleSetFoldersForSelectedArtist = async (folderIds: string[]) => {
    if (!selectedArtist) {
      return
    }
    const res = await window.api.setAnimaArtistFolders({
      artistId: selectedArtist.id,
      folderIds,
    })
    if (!res.success) {
      setError(res.error?.message ?? '更新文件夹失败。')
      return
    }
    setSelectedArtist((prev) => prev ? { ...prev, folderIds, folderNames: folders.filter((folder) => folderIds.includes(folder.id)).map((folder) => folder.name) } : prev)
    await Promise.all([loadFolders(), loadArtists()])
  }

  const previewImageSrc = selectedArtist
    ? toImageSrc({ localPath: selectedArtist.previewImage.localPath, originalUrl: '' })
    : null

  if (isLoadingList && !status) {
    return <div className={styles.stateShell}>⏳ 正在加载画师参考库...</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>画师参考</h1>
          <p className={styles.subtitle}>导入 Anima Style Explorer 离线库后，在软件内检索画师串、管理收藏与文件夹，并一键送去测试。</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.primaryBtn} onClick={() => void handleImport()} disabled={isImporting}>
            {isImporting ? '导入中...' : status?.imported ? '重新导入' : '导入离线库'}
          </button>
        </div>
      </header>

      {!status?.imported ? (
        <section className={styles.emptyShell}>
          <div className={styles.emptyCard}>
            <h2>尚未导入 Anima 离线库</h2>
            <p>将 `Anima-Style-Explorer-main` 导入到当前应用数据目录后，这里会提供 2 万+ 画师参考图浏览与送测入口。</p>
            <label className={styles.field}>
              <span>离线目录路径</span>
              <input
                value={sourcePathDraft}
                onChange={(e) => setSourcePathDraft(e.target.value)}
                placeholder={DEFAULT_SOURCE_PATH}
              />
            </label>
            <div className={styles.inlineActions}>
              <button className={styles.primaryBtn} onClick={() => void handleImport()} disabled={isImporting}>
                {isImporting ? '导入中...' : '开始导入'}
              </button>
            </div>
          </div>
          {error && <div className={styles.errorBox}>{error}</div>}
        </section>
      ) : (
        <>
          <section className={styles.toolbar}>
            <label className={styles.field}>
              <span>搜索</span>
              <input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="按画师名搜索..."
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    setAppliedSearch(searchDraft.trim())
                    setPage(1)
                  }
                }}
              />
            </label>

            <label className={styles.field}>
              <span>排序</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as AnimaArtistSortBy)}>
                <option value="post_count">作品数</option>
                <option value="uniqueness_score">独特度</option>
                <option value="name">名称</option>
                <option value="favorited_at">收藏时间</option>
              </select>
            </label>

            <div className={styles.segmentGroup}>
              <button className={sortOrder === 'desc' ? styles.segmentActive : styles.segment} onClick={() => setSortOrder('desc')}>
                ↓ 降序
              </button>
              <button className={sortOrder === 'asc' ? styles.segmentActive : styles.segment} onClick={() => setSortOrder('asc')}>
                ↑ 升序
              </button>
            </div>

            <div className={styles.segmentGroup}>
              <button className={!favoritesOnly ? styles.segmentActive : styles.segment} onClick={() => setFavoritesOnly(false)}>
                全部
              </button>
              <button className={favoritesOnly ? styles.segmentActive : styles.segment} onClick={() => setFavoritesOnly(true)}>
                仅收藏
              </button>
            </div>

            <label className={styles.field}>
              <span>文件夹过滤</span>
              <select value={activeFolderId} onChange={(e) => { setActiveFolderId(e.target.value); setPage(1) }}>
                <option value="">全部文件夹</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>{folder.name}</option>
                ))}
              </select>
            </label>

            <div className={styles.inlineActions}>
              <button className={styles.secondaryBtn} onClick={() => { setAppliedSearch(searchDraft.trim()); setPage(1) }}>搜索</button>
              <button className={styles.secondaryBtn} onClick={() => { setSearchDraft(''); setAppliedSearch(''); setPage(1) }}>清空</button>
            </div>
          </section>

          <section className={styles.statsRow}>
            <div className={styles.statCard}><span>画师总数</span><strong>{formatNumber(status.totalArtists)}</strong></div>
            <div className={styles.statCard}><span>当前结果</span><strong>{formatNumber(total)}</strong></div>
            <div className={styles.statCard}><span>已收藏</span><strong>{formatNumber(status.favoritesCount)}</strong></div>
            <div className={styles.statCard}><span>文件夹</span><strong>{formatNumber(status.folderCount)}</strong></div>
          </section>

          {(notice || error) && (
            <div className={notice ? styles.noticeBox : styles.errorBox}>{notice || error}</div>
          )}

          <section className={styles.layout}>
            <aside className={styles.sidebar}>
              <div className={styles.sidebarCard}>
                <div className={styles.sectionTitleRow}>
                  <h2>文件夹</h2>
                  <button className={styles.secondaryBtn} onClick={() => void handleCreateFolder()}>新建</button>
                </div>
                <div className={styles.folderList}>
                  {folders.length === 0 ? (
                    <div className={styles.muted}>还没有文件夹</div>
                  ) : folders.map((folder) => (
                    <div key={folder.id} className={`${styles.folderItem} ${activeFolderId === folder.id ? styles.folderItemActive : ''}`}>
                      <button className={styles.folderButton} onClick={() => setActiveFolderId((current) => current === folder.id ? '' : folder.id)}>
                        <span>{folder.name}</span>
                        <span>{folder.artistCount}</span>
                      </button>
                      <button className={styles.iconBtn} onClick={() => void handleDeleteFolder(folder)} title="删除文件夹">✕</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.sidebarCard}>
                <div className={styles.sectionTitleRow}>
                  <h2>批量操作</h2>
                  <span>{selectedIds.length} 已选</span>
                </div>
                <div className={styles.stackActions}>
                  <button className={styles.secondaryBtn} onClick={() => void handleCopy(selectedArtistsOnPage.map((artist) => artist.name))}>
                    复制当前页已选
                  </button>
                  <button className={styles.secondaryBtn} onClick={() => handleSendToTesting(selectedIds, 'comfy')}>
                    送测 ComfyUI
                  </button>
                  <button className={styles.secondaryBtn} onClick={() => handleSendToTesting(selectedIds, 'nai')}>
                    送测 NAI
                  </button>
                  <button className={styles.secondaryBtn} onClick={() => void handleExport('txt')}>
                    导出 TXT
                  </button>
                  <button className={styles.secondaryBtn} onClick={() => void handleExport('json')}>
                    导出 JSON
                  </button>
                  <button className={styles.secondaryBtn} onClick={() => void handleImportFavorites()}>
                    导入 JSON
                  </button>
                  <button className={styles.secondaryBtn} onClick={() => void handleApplyCurrentFolderToSelection()} disabled={!activeFolderId || selectedIds.length === 0}>
                    加入当前文件夹
                  </button>
                </div>
              </div>
            </aside>

            <div className={styles.content}>
              <div className={styles.listHeader}>
                <div>第 {page} / {totalPages} 页 · 共 {formatNumber(total)} 位画师</div>
                <div className={styles.inlineActions}>
                  <button className={styles.secondaryBtn} onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>上一页</button>
                  <button className={styles.secondaryBtn} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page >= totalPages}>下一页</button>
                </div>
              </div>

              {isLoadingList ? (
                <div className={styles.stateShell}>⏳ 正在加载画师列表...</div>
              ) : artists.length === 0 ? (
                <div className={styles.stateShell}>当前筛选下没有画师。</div>
              ) : (
                <div className={styles.grid}>
                  {artists.map((artist) => {
                    const previewSrc = toImageSrc({ localPath: artist.previewImage.localPath, originalUrl: '' })
                    const selected = selectedIds.includes(artist.id)
                    return (
                      <article
                        key={artist.id}
                        className={`${styles.card} ${selectedArtistId === artist.id ? styles.cardActive : ''}`}
                        onClick={() => setSelectedArtistId(artist.id)}
                      >
                        <button
                          className={`${styles.selectBadge} ${selected ? styles.selectBadgeActive : ''}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleToggleSelected(artist.id)
                          }}
                        >
                          {selected ? '✓' : '+'}
                        </button>
                        {previewSrc ? (
                          <img className={styles.cardImage} src={previewSrc} alt={artist.name} loading="lazy" />
                        ) : (
                          <div className={styles.cardImagePlaceholder}>无预览图</div>
                        )}
                        <div className={styles.cardBody}>
                          <div className={styles.cardTitleRow}>
                            <h3>{artist.name}</h3>
                            <button
                              className={styles.iconBtn}
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleToggleFavorite(artist, !artist.isFavorited)
                              }}
                              title={artist.isFavorited ? '取消收藏' : '加入收藏'}
                            >
                              {artist.isFavorited ? '★' : '☆'}
                            </button>
                          </div>
                          <div className={styles.cardMeta}>Works {formatNumber(artist.postCount)} · Unique {formatScore(artist.uniquenessScore)}</div>
                          {artist.folderIds.length > 0 && (
                            <div className={styles.cardTags}>
                              {artist.folderIds.slice(0, 3).map((folderId) => {
                                const folder = folders.find((item) => item.id === folderId)
                                return folder ? <span key={folderId}>{folder.name}</span> : null
                              })}
                            </div>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>

            <aside className={styles.detailPanel}>
              {!selectedArtist ? (
                <div className={styles.stateShell}>选择一个画师查看详情。</div>
              ) : isLoadingDetail ? (
                <div className={styles.stateShell}>⏳ 正在加载详情...</div>
              ) : (
                <>
                  {previewImageSrc ? (
                    <img className={styles.detailImage} src={previewImageSrc} alt={selectedArtist.name} />
                  ) : (
                    <div className={styles.detailPlaceholder}>无预览图</div>
                  )}
                  <div className={styles.detailSection}>
                    <h2>{selectedArtist.name}</h2>
                    <div className={styles.detailMeta}>Works {formatNumber(selectedArtist.postCount)} · Unique {formatScore(selectedArtist.uniquenessScore)}</div>
                    <div className={styles.inlineActions}>
                      <button className={styles.secondaryBtn} onClick={() => void handleCopy([selectedArtist.name])}>复制画师名</button>
                      <button className={styles.secondaryBtn} onClick={() => handleSendToTesting([selectedArtist.id], 'comfy')}>送测 ComfyUI</button>
                      <button className={styles.secondaryBtn} onClick={() => handleSendToTesting([selectedArtist.id], 'nai')}>送测 NAI</button>
                    </div>
                  </div>

                  <div className={styles.detailSection}>
                    <div className={styles.sectionTitleRow}>
                      <h3>文件夹归类</h3>
                      <button
                        className={styles.secondaryBtn}
                        onClick={() => void handleToggleFavorite(selectedArtist, !selectedArtist.isFavorited)}
                      >
                        {selectedArtist.isFavorited ? '取消收藏' : '加入收藏'}
                      </button>
                    </div>
                    <div className={styles.folderChecklist}>
                      {folders.length === 0 ? (
                        <div className={styles.muted}>先创建文件夹后再归类。</div>
                      ) : folders.map((folder) => {
                        const checked = selectedArtist.folderIds.includes(folder.id)
                        return (
                          <label key={folder.id} className={styles.checkItem}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                const nextFolderIds = event.target.checked
                                  ? [...selectedArtist.folderIds, folder.id]
                                  : selectedArtist.folderIds.filter((id) => id !== folder.id)
                                void handleSetFoldersForSelectedArtist([...new Set(nextFolderIds)])
                              }}
                            />
                            <span>{folder.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </aside>
          </section>
        </>
      )}
    </div>
  )
}
