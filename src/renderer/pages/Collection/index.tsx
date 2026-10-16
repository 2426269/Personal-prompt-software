import type { PromptPresetDetail, PromptPresetSection, PromptPresetSummary, PromptPresetSyntaxMode } from '@shared/types/preset'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { toImageSrc } from '@renderer/utils/image-src'
import { formatPromptPresetText } from '@renderer/utils/prompt-presets'
import { buildTestingSearch } from '@renderer/utils/testing-route'

import styles from './Collection.module.css'

function matchesPreset(summary: PromptPresetSummary, query: string): boolean {
  if (!query) {
    return true
  }

  const normalized = query.toLowerCase()
  return [
    summary.name,
    summary.sourceEntryTitle,
    summary.sourcePromptType,
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalized)
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN')
}

function buildEntryImageSearch(imageIndex: number): string {
  return `?imageIndex=${imageIndex}`
}

function resolveTestingModeFromPreset(type: PromptPresetSummary['sourcePromptType']): 'comfy' | 'nai' {
  return type === 'NAI' ? 'nai' : 'comfy'
}

export function Collection() {
  const navigate = useNavigate()
  const [presets, setPresets] = useState<PromptPresetSummary[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<PromptPresetDetail | null>(null)
  const [syntaxMode, setSyntaxMode] = useState<PromptPresetSyntaxMode>('sd')
  const [search, setSearch] = useState('')
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadList() {
      try {
        setIsLoadingList(true)
        setError('')
        const res = await window.api.listPromptPresets()

        if (cancelled) {
          return
        }

        if (!res.success || !res.data) {
          setError(res.error?.message ?? '提示词预设加载失败。')
          return
        }

        const presetList = res.data
        setPresets(presetList)
        setSelectedPresetId((current) => current ?? presetList[0]?.id ?? null)
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

    void loadList()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadDetail() {
      if (!selectedPresetId) {
        setSelectedPreset(null)
        return
      }

      try {
        setIsLoadingDetail(true)
        const res = await window.api.getPromptPreset(selectedPresetId)

        if (cancelled) {
          return
        }

        if (!res.success) {
          setError(res.error?.message ?? '预设详情加载失败。')
          return
        }

        setSelectedPreset(res.data ?? null)
        setSyntaxMode(res.data?.defaultSyntaxMode ?? 'sd')
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
  }, [selectedPresetId])

  const filteredPresets = useMemo(
    () => presets.filter((preset) => matchesPreset(preset, search.trim())),
    [presets, search],
  )

  useEffect(() => {
    if (filteredPresets.length === 0) {
      return
    }

    if (!selectedPresetId || !filteredPresets.some((preset) => preset.id === selectedPresetId)) {
      setSelectedPresetId(filteredPresets[0].id)
    }
  }, [filteredPresets, selectedPresetId])

  const positiveText = useMemo(
    () => formatPromptPresetText(selectedPreset?.positiveSections ?? [], syntaxMode),
    [selectedPreset?.positiveSections, syntaxMode],
  )
  const negativeText = useMemo(
    () => formatPromptPresetText(selectedPreset?.negativeSections ?? [], syntaxMode),
    [selectedPreset?.negativeSections, syntaxMode],
  )
  const referenceImageSrc = useMemo(
    () =>
      selectedPreset
        ? toImageSrc({
            originalUrl: selectedPreset.referenceImage.originalUrl ?? '',
            localPath: selectedPreset.referenceImage.localPath,
          })
        : null,
    [selectedPreset],
  )

  const handleDeletePreset = async () => {
    if (!selectedPreset) {
      return
    }

    const confirmed = window.confirm(`确定删除预设「${selectedPreset.name}」吗？`)
    if (!confirmed) {
      return
    }

    const res = await window.api.deletePromptPreset(selectedPreset.id)
    if (!res.success) {
      setError(res.error?.message ?? '删除预设失败。')
      return
    }

    setPresets((prev) => prev.filter((preset) => preset.id !== selectedPreset.id))
    setSelectedPresetId((prev) => {
      if (prev !== selectedPreset.id) {
        return prev
      }

      const next = presets.find((preset) => preset.id !== selectedPreset.id)
      return next?.id ?? null
    })
    setSelectedPreset(null)
  }

  const handleCopy = async (text: string, label: string) => {
    if (!text) {
      return
    }

    await navigator.clipboard.writeText(text)
    alert(`${label}已复制到剪贴板`)
  }

  if (isLoadingList) {
    return <div className={styles.stateShell}>⏳ 正在加载提示词预设库...</div>
  }

  if (error && presets.length === 0) {
    return <div className={styles.stateShell}>{error}</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>提示词预设库</h1>
          <p className={styles.subtitle}>预设只来自单张图片的 LLM 分析结果导出，可在详情页继续新增。</p>
        </div>
        <div className={styles.headerStats}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>预设总数</span>
            <strong>{presets.length}</strong>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>当前筛选</span>
            <strong>{filteredPresets.length}</strong>
          </div>
        </div>
      </header>

      <section className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarCard}>
            <input
              className={styles.searchInput}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索预设名 / 来源条目 / 类型"
            />
          </div>

          <div className={styles.sidebarCard}>
            <div className={styles.sidebarMeta}>共 {filteredPresets.length} 条可用预设</div>

            {filteredPresets.length === 0 ? (
              <div className={styles.sidebarEmpty}>
                预设库还是空的。先去详情页完成当前图片分析，再点击“导出为预设”。
              </div>
            ) : (
              <div className={styles.presetList}>
                {filteredPresets.map((preset) => {
                  const coverSrc = toImageSrc({
                    originalUrl: preset.referenceImage.originalUrl ?? '',
                    localPath: preset.referenceImage.localPath,
                  })
                  return (
                    <button
                      key={preset.id}
                      className={`${styles.presetListItem} ${preset.id === selectedPresetId ? styles.presetListItemActive : ''}`}
                      onClick={() => setSelectedPresetId(preset.id)}
                    >
                      {coverSrc ? (
                        <img className={styles.presetThumb} src={coverSrc} alt={preset.name} loading="lazy" />
                      ) : (
                        <div className={styles.presetThumbPlaceholder}>📝</div>
                      )}
                      <div className={styles.presetListBody}>
                        <div className={styles.presetName}>{preset.name}</div>
                        <div className={styles.presetSource}>
                          {preset.sourceEntryTitle} · 图 {preset.sourceImageIndex + 1}
                        </div>
                        <div className={styles.presetCounts}>
                          <span>正向 {preset.positiveItemCount}</span>
                          <span>负向 {preset.negativeItemCount}</span>
                          <span>{preset.sourcePromptType}</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </aside>

        <main className={styles.detailPanel}>
          {!selectedPresetId ? (
            <div className={styles.emptyDetail}>
              <div className={styles.emptyIcon}>🧩</div>
              <h2>还没有可展示的预设</h2>
              <p>在详情页导出第一条预设后，这里会展示正向、负向和参考图。</p>
            </div>
          ) : isLoadingDetail || !selectedPreset ? (
            <div className={styles.emptyDetail}>⏳ 正在加载预设详情...</div>
          ) : (
            <>
              <div className={styles.detailHeader}>
                <div>
                  <div className={styles.detailMeta}>来源：{selectedPreset.sourceEntryTitle} · 图 {selectedPreset.sourceImageIndex + 1}</div>
                  <h2 className={styles.detailTitle}>{selectedPreset.name}</h2>
                  <div className={styles.detailMeta}>
                    {selectedPreset.sourcePromptType} · 创建于 {formatTime(selectedPreset.createdAt)} · 更新于 {formatTime(selectedPreset.updatedAt)}
                  </div>
                </div>

                <div className={styles.detailActions}>
                  <div className={styles.syntaxSwitch}>
                    <button
                      className={`${styles.syntaxButton} ${syntaxMode === 'sd' ? styles.syntaxButtonActive : ''}`}
                      onClick={() => setSyntaxMode('sd')}
                    >
                      ComfyUI / SD
                    </button>
                    <button
                      className={`${styles.syntaxButton} ${syntaxMode === 'nai' ? styles.syntaxButtonActive : ''}`}
                      onClick={() => setSyntaxMode('nai')}
                    >
                      NAI
                    </button>
                  </div>

                  <button
                    className={styles.secondaryButton}
                    onClick={() =>
                      void navigate({
                        pathname: `/entry/${selectedPreset.sourceEntryId}`,
                        search: buildEntryImageSearch(selectedPreset.sourceImageIndex),
                      })
                    }
                  >
                    打开来源图片
                  </button>
                  <button
                    className={styles.primaryButton}
                    onClick={() =>
                      void navigate({
                        pathname: '/testing',
                        search: buildTestingSearch({
                          mode: resolveTestingModeFromPreset(selectedPreset.sourcePromptType),
                          entryId: selectedPreset.sourceEntryId,
                          imageIndex: selectedPreset.sourceImageIndex,
                          presetId: selectedPreset.id,
                        }),
                      })
                    }
                  >
                    发送到测试页
                  </button>
                  <button className={styles.dangerButton} onClick={() => void handleDeletePreset()}>
                    删除预设
                  </button>
                </div>
              </div>

              {error && <div className={styles.errorBanner}>{error}</div>}

              <div className={styles.detailGrid}>
                <div className={styles.promptColumn}>
                  <PromptBlock
                    title="正向提示词"
                    description="支持一键复制全部正向内容，并按分类查看 note。"
                    text={positiveText}
                    sections={selectedPreset.positiveSections}
                    syntaxMode={syntaxMode}
                    onCopy={() => void handleCopy(positiveText, '正向提示词')}
                  />
                  <PromptBlock
                    title="负向提示词"
                    description="保存自分析结果里的反向分类，可独立切换语法并复制。"
                    text={negativeText}
                    sections={selectedPreset.negativeSections}
                    syntaxMode={syntaxMode}
                    onCopy={() => void handleCopy(negativeText, '负向提示词')}
                  />
                </div>

                <aside className={styles.referenceColumn}>
                  <div className={styles.referenceCard}>
                    <div className={styles.referenceTitle}>参考图</div>
                    {referenceImageSrc ? (
                      <img className={styles.referenceImage} src={referenceImageSrc} alt={selectedPreset.name} />
                    ) : (
                      <div className={styles.referencePlaceholder}>没有可显示的参考图</div>
                    )}
                    <button
                      className={styles.primaryButton}
                      onClick={() =>
                        void navigate({
                          pathname: `/entry/${selectedPreset.sourceEntryId}`,
                          search: buildEntryImageSearch(selectedPreset.sourceImageIndex),
                        })
                      }
                    >
                      回到来源详情
                    </button>
                  </div>
                </aside>
              </div>
            </>
          )}
        </main>
      </section>
    </div>
  )
}

interface PromptBlockProps {
  title: string
  description: string
  text: string
  sections: PromptPresetSection[]
  syntaxMode: PromptPresetSyntaxMode
  onCopy: () => void
}

function PromptBlock({ title, description, text, sections, syntaxMode, onCopy }: PromptBlockProps) {
  return (
    <section className={styles.promptBlock}>
      <div className={styles.promptHeader}>
        <div>
          <h3 className={styles.promptTitle}>{title}</h3>
          <div className={styles.promptDescription}>{description}</div>
        </div>
        <button className={styles.primaryButton} onClick={onCopy} disabled={!text}>
          一键复制
        </button>
      </div>

      <div className={styles.promptText}>{text || '当前没有可导出的内容。'}</div>
      <div className={styles.syntaxHint}>当前语法：{syntaxMode === 'sd' ? 'ComfyUI / SD' : 'NAI'}</div>

      <div className={styles.sectionGrid}>
        {sections.length === 0 ? (
          <div className={styles.sectionEmpty}>暂无该方向条目。</div>
        ) : (
          sections.map((section) => (
            <div key={section.key} className={styles.sectionCard}>
              <div className={styles.sectionTitle}>{section.label}</div>
              <div className={styles.itemStack}>
                {section.items.map((item) => (
                  <div key={item.id} className={styles.itemCard}>
                    <div className={styles.itemText}>{item.text}</div>
                    <div className={styles.itemMeta}>
                      {item.weight != null && <span>权重 {item.weight}</span>}
                      {item.note && <span>{item.note}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
