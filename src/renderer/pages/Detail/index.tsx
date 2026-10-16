import type { CivitaiModelMatch } from '@shared/types/civitai'
import type { EntryDetail } from '@shared/types/entry'
import type { PromptModelReference } from '@shared/types/importer'
import type { EntryRemoteModelCheck, EntryRemoteModelMatch, RemoteModelKind } from '@shared/types/remote'
import type { UserTag } from '@shared/types/tag'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createSearchParams, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { AnalysisPanel } from '@renderer/components/entry/AnalysisPanel'
import { ImageGallery } from '@renderer/components/entry/ImageGallery'
import { RawPayload } from '@renderer/components/entry/RawPayload'
import { SourceCard } from '@renderer/components/entry/SourceCard'
import { TagManager } from '@renderer/components/entry/TagManager'
import { ExportPresetModal } from '@renderer/components/preset/ExportPresetModal'
import { toImageSrc } from '@renderer/utils/image-src'
import { buildTestingSearch } from '@renderer/utils/testing-route'

import styles from './Detail.module.css'

function clampIndex(nextIndex: number, total: number): number {
  if (total <= 0) {
    return 0
  }

  return Math.min(Math.max(nextIndex, 0), total - 1)
}

function buildModelKey(kind: RemoteModelKind, model: PromptModelReference): string {
  return `${kind}:${model.text}:${model.hash ?? ''}:${model.modelVersionId ?? ''}`
}

function normalizeModelToken(value: string): string {
  return value.replace(/\\/g, '/').trim().toLowerCase()
}

function normalizeModelStem(value: string): string {
  const normalized = normalizeModelToken(value)
  const basename = normalized.split('/').pop() ?? normalized
  return basename.replace(/\.[^/.]+$/, '')
}

function mergeDisplayModel(
  model: PromptModelReference,
  parsedModels: PromptModelReference[],
): PromptModelReference {
  const modelHash = model.hash?.toLowerCase() ?? null
  const modelVersionId = model.modelVersionId ?? null
  const modelStem = normalizeModelStem(model.text)

  const matched = parsedModels.find((item) => {
    if (modelVersionId != null && item.modelVersionId != null && item.modelVersionId === modelVersionId) {
      return true
    }

    if (modelHash && item.hash && item.hash.toLowerCase() === modelHash) {
      return true
    }

    return normalizeModelStem(item.text) === modelStem
  }) ?? null

  if (!matched) {
    return model
  }

  return {
    ...model,
    hash: model.hash ?? matched.hash ?? null,
    modelId: model.modelId ?? matched.modelId ?? null,
    modelVersionId: model.modelVersionId ?? matched.modelVersionId ?? null,
  }
}

function resolveRemoteMatch(
  kind: RemoteModelKind,
  model: PromptModelReference,
  remoteCheck: EntryRemoteModelCheck | null,
): EntryRemoteModelMatch | undefined {
  if (!remoteCheck) {
    return undefined
  }

  const exact = remoteCheck.items.find((item) => buildModelKey(kind, item.model) === buildModelKey(kind, model))
  if (exact) {
    return exact
  }

  const modelHash = model.hash?.toLowerCase() ?? null
  const modelVersionId = model.modelVersionId ?? null
  const modelStem = normalizeModelStem(model.text)

  return remoteCheck.items.find((item) => {
    if (modelVersionId != null && item.model.modelVersionId != null && item.model.modelVersionId === modelVersionId) {
      return true
    }

    if (modelHash && item.model.hash && item.model.hash.toLowerCase() === modelHash) {
      return true
    }

    return normalizeModelStem(item.model.text) === modelStem
  })
}

function getMatchBadge(match: EntryRemoteModelMatch | undefined): string | null {
  if (!match) {
    return null
  }

  if (!match.exists) {
    return '缺失'
  }

  if (match.matchType === 'exact_version') {
    return '版本命中'
  }

  if (match.matchType === 'exact_hash') {
    return '哈希命中'
  }

  return '名称命中'
}

function getMatchClass(match: EntryRemoteModelMatch | undefined): string {
  if (!match || !match.exists) {
    return styles.loraMissing
  }

  return styles.loraExists
}

function shouldUseSdExactLookup(entry: EntryDetail, model: PromptModelReference): boolean {
  return entry.type === 'SD' && (model.hash != null || model.modelVersionId != null)
}

function getPrecisionBadge(entry: EntryDetail, model: PromptModelReference, match: EntryRemoteModelMatch | undefined): string | null {
  if (!shouldUseSdExactLookup(entry, model)) {
    return null
  }

  if (match?.matchType === 'exact_version') {
    return '版本命中'
  }

  if (match?.matchType === 'exact_hash') {
    return '哈希命中'
  }

  if (model.modelVersionId != null) {
    return '版本未命中'
  }

  if (model.hash) {
    return '哈希未命中'
  }

  return null
}

function shouldShowCivitaiSearch(
  entry: EntryDetail,
  model: PromptModelReference,
  remoteCheck: EntryRemoteModelCheck | null,
  remoteMatch: EntryRemoteModelMatch | undefined,
): boolean {
  if (!remoteCheck?.isScanned) {
    return false
  }

  if (!remoteMatch?.exists) {
    return true
  }

  return shouldUseSdExactLookup(entry, model)
    && remoteMatch.matchType !== 'exact_hash'
    && remoteMatch.matchType !== 'exact_version'
}

export function Detail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const api = window.api

  const [entry, setEntry] = useState<EntryDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false)
  const [searchingModelKey, setSearchingModelKey] = useState<string | null>(null)
  const [civitaiMatches, setCivitaiMatches] = useState<Record<string, CivitaiModelMatch | null>>({})
  const [civitaiErrors, setCivitaiErrors] = useState<Record<string, string>>({})

  const testingMode = entry?.type === 'NAI' ? 'nai' : 'comfy'
  const requestedImageIndex = useMemo(() => {
    const rawValue = searchParams.get('imageIndex')
    if (rawValue == null) {
      return null
    }

    const parsedValue = Number(rawValue)
    return Number.isInteger(parsedValue) && parsedValue >= 0 ? parsedValue : null
  }, [searchParams])

  const fetchEntry = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    setError('')
    try {
      const res = await api.getEntry(id)
      if (res.success && res.data) {
        const entryData = res.data
        setEntry(entryData)
        setCurrentImageIndex((prev) => clampIndex(prev, entryData.images.length))
      } else {
        setError(res.error?.message ?? '未找到该条目。')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [api, id])

  useEffect(() => {
    void fetchEntry()
  }, [fetchEntry])

  useEffect(() => {
    if (!entry || requestedImageIndex == null) {
      return
    }

    const matchedImagePosition = entry.images.findIndex((image) => image.index === requestedImageIndex)
    const nextImagePosition = matchedImagePosition >= 0 ? matchedImagePosition : requestedImageIndex
    setCurrentImageIndex(clampIndex(nextImagePosition, entry.images.length))
  }, [entry, requestedImageIndex])

  useEffect(() => {
    setCivitaiMatches({})
    setCivitaiErrors({})
  }, [entry?.id, currentImageIndex])

  const currentImage = useMemo(() => entry?.images[currentImageIndex] ?? null, [currentImageIndex, entry])
  const currentImageSrc = currentImage ? toImageSrc(currentImage) : null
  const currentAnalysis = useMemo(() => {
    if (!entry) {
      return null
    }

    const imageSlot = currentImage?.index ?? null
    return entry.analyses.find((analysis) => analysis.imageIndex === imageSlot) ?? null
  }, [currentImage?.index, entry])
  const displayLoras = useMemo(() => {
    if (!currentAnalysis) {
      return []
    }

    return currentAnalysis.settingsCommon.loras.map((item) =>
      mergeDisplayModel(item, currentImage?.parsedLoras ?? []),
    )
  }, [currentAnalysis, currentImage?.parsedLoras])
  const displayCheckpoints = useMemo(() => {
    if (!currentAnalysis?.settingsCommon.model) {
      return []
    }

    return [
      mergeDisplayModel(
        { text: currentAnalysis.settingsCommon.model },
        currentImage?.parsedCheckpoints ?? [],
      ),
    ]
  }, [currentAnalysis?.settingsCommon.model, currentImage?.parsedCheckpoints])
  const displayRemoteLoraCheck = currentImage?.remoteLoraCheck ?? null
  const displayRemoteCheckpointCheck = currentImage?.remoteCheckpointCheck ?? null

  const handleToggleFavorite = async () => {
    if (!entry) return
    try {
      const res = await api.updateEntry({
        id: entry.id,
        isFavorited: !entry.isFavorited,
      })
      if (res.success) {
        setEntry((prev) => prev ? { ...prev, isFavorited: !prev.isFavorited } : prev)
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err)
    }
  }

  const handleDelete = async () => {
    if (!entry) return
    try {
      const res = await api.deleteEntry({ id: entry.id, mode: 'soft' })
      if (res.success) {
        void navigate('/')
      }
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const handleCopyText = (text: string) => {
    void navigator.clipboard.writeText(text)
  }

  const handleNavigateByTag = (tag: string) => {
    const search = createSearchParams({
      mode: 'basic',
      q: tag,
      type: 'all',
      page: '1',
    }).toString()
    void navigate({ pathname: '/', search: `?${search}` })
  }

  const handleAnalyze = async () => {
    if (!entry) return
    try {
      setIsAnalyzing(true)
      const res = await api.analyzeEntry({
        entryId: entry.id,
        imageIndex: currentImage?.index ?? currentImageIndex,
      })
      if (res.success && res.data) {
        const analysisResult = res.data.analysis
        setEntry((prev) => {
          if (!prev) {
            return prev
          }

          const nextAnalyses = prev.analyses.filter((analysis) => analysis.imageIndex !== analysisResult.imageIndex)
          nextAnalyses.push(analysisResult)
          nextAnalyses.sort((left, right) => {
            if (left.imageIndex == null && right.imageIndex == null) return 0
            if (left.imageIndex == null) return 1
            if (right.imageIndex == null) return -1
            return left.imageIndex - right.imageIndex
          })

          return {
            ...prev,
            analysis: analysisResult,
            analyses: nextAnalyses,
          }
        })
      } else {
        const msg = res.error ? (typeof res.error === 'string' ? res.error : res.error.message) : '分析失败'
        alert(`分析失败: ${msg}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      alert(`分析出错: ${msg}`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSearchCivitai = async (kind: RemoteModelKind, model: PromptModelReference) => {
    const key = buildModelKey(kind, model)
    const currentEntry = entry
    if (!currentEntry) {
      return
    }

    const useSdExactLookup = shouldUseSdExactLookup(currentEntry, model)

    try {
      setSearchingModelKey(key)
      setCivitaiErrors((prev) => ({ ...prev, [key]: '' }))
      const request = {
        kind,
        query: model.text,
        hash: model.hash ?? null,
        modelId: model.modelId ?? null,
        modelVersionId: model.modelVersionId ?? null,
      }
      const res = useSdExactLookup
        ? model.hash
          ? await api.getCivitaiByHash(request)
          : await api.getCivitaiByVersion(request)
        : await api.searchCivitaiModel(request)

      if (!res.success) {
        throw new Error(res.error?.message ?? '搜索失败')
      }

      setCivitaiMatches((prev) => ({ ...prev, [key]: res.data ?? null }))
      if (useSdExactLookup && !res.data) {
        setCivitaiErrors((prev) => ({
          ...prev,
          [key]: '当前 SD 模型已按 hash/版本做精确查询，但未命中 Civitai；默认不再自动回退名称猜测。',
        }))
      }
    } catch (err) {
      setCivitaiErrors((prev) => ({ ...prev, [key]: err instanceof Error ? err.message : String(err) }))
    } finally {
      setSearchingModelKey(null)
    }
  }

  const parsedRaw = entry?.rawJson ? (() => {
    try {
      return JSON.parse(entry.rawJson) as Record<string, unknown>
    } catch {
      return null
    }
  })() : null

  const shiftImage = (delta: number) => {
    setCurrentImageIndex((prev) => clampIndex(prev + delta, entry?.images.length ?? 0))
  }

  const renderModelSection = (
    title: string,
    kind: RemoteModelKind,
    models: PromptModelReference[],
    remoteCheck: EntryRemoteModelCheck | null,
  ) => {
    const currentEntry = entry
    if (!currentEntry) {
      return null
    }

    if (!currentAnalysis) {
      return (
        <div className={styles.sideCard}>
          <div className={styles.sideSectionTitle}>{title}</div>
          <div className={styles.sideHint}>等待分析</div>
        </div>
      )
    }

    if (models.length === 0) {
      return null
    }

    return (
      <div className={styles.sideCard}>
        <div className={styles.sideSectionTitle}>{title}</div>
        {remoteCheck === null && (
          <div className={styles.sideHint}>未配置默认远端模型索引，暂时无法判断远端是否存在。</div>
        )}
        {remoteCheck && !remoteCheck.isScanned && (
          <div className={styles.sideHint}>
            默认远端「{remoteCheck.profileName}」已配置，但尚未执行扫描。
          </div>
        )}
        <div className={styles.modelList}>
          {models.map((model) => {
            const key = buildModelKey(kind, model)
            const remoteMatch = resolveRemoteMatch(kind, model, remoteCheck)
            const civitaiMatch = civitaiMatches[key]
            const civitaiError = civitaiErrors[key]
            const matchLabel = getMatchBadge(remoteMatch)
            const precisionLabel = getPrecisionBadge(currentEntry, model, remoteMatch)
            const showSearchButton = shouldShowCivitaiSearch(currentEntry, model, remoteCheck, remoteMatch)

            return (
              <div key={key} className={styles.modelCard}>
                <div className={styles.modelHeader}>
                  <div className={styles.modelTitleLine}>
                    <span className={styles.loraPill}>
                      {model.text}
                      {model.weight != null && model.weight !== 1 && <span className={styles.loraWeight}>:{model.weight}</span>}
                    </span>
                    {matchLabel && (
                      <span
                        className={`${styles.loraStatus} ${getMatchClass(remoteMatch)}`}
                        title={remoteMatch?.matchedPath ?? '未命中远端模型'}
                      >
                        {matchLabel}
                      </span>
                    )}
                    {precisionLabel && precisionLabel !== matchLabel && (
                      <span
                        className={`${styles.loraStatus} ${
                          precisionLabel.endsWith('命中') ? styles.loraExists : styles.loraMissing
                        }`}
                      >
                        {precisionLabel}
                      </span>
                    )}
                  </div>
                  <div className={styles.modelMetaLine}>
                    {model.hash && <span className={styles.modelMeta}>hash {model.hash.slice(0, 12)}...</span>}
                    {model.modelVersionId != null && <span className={styles.modelMeta}>version #{model.modelVersionId}</span>}
                  </div>
                </div>

                {showSearchButton && (
                  <div className={styles.modelActions}>
                    <button
                        className={styles.btnSecondary}
                        onClick={() => void handleSearchCivitai(kind, model)}
                        disabled={searchingModelKey === key}
                      >
                      {searchingModelKey === key
                        ? '搜索中...'
                        : shouldUseSdExactLookup(currentEntry, model)
                          ? '按 hash/版本搜索 Civitai'
                          : '搜索 Civitai'}
                    </button>
                  </div>
                )}

                {civitaiError && <div className={styles.modelError}>{civitaiError}</div>}

                {civitaiMatch && (
                  <div className={styles.civitaiCard}>
                    <div className={styles.civitaiHeader}>
                      <strong>{civitaiMatch.name}</strong>
                      <span className={`${styles.loraStatus} ${civitaiMatch.confidence === 'exact' ? styles.loraExists : styles.loraMissing}`}>
                        {civitaiMatch.confidence === 'exact' ? '精确命中' : '名称猜测'}
                      </span>
                    </div>
                    <div className={styles.modelMetaLine}>
                      {civitaiMatch.versionName && <span className={styles.modelMeta}>版本：{civitaiMatch.versionName}</span>}
                      {civitaiMatch.modelType && <span className={styles.modelMeta}>类型：{civitaiMatch.modelType}</span>}
                    </div>
                    <div className={styles.modelActions}>
                      <button className={styles.btnSecondary} onClick={() => window.open(civitaiMatch.pageUrl, '_blank', 'noopener')}>
                        打开 Civitai 页面
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={styles.detailPage}>
        <div className={styles.stateShell}>⏳ 加载中...</div>
      </div>
    )
  }

  if (error || !entry) {
    return (
      <div className={styles.detailPage}>
        <div className={styles.stateShell}>
          <div className={styles.stateIcon}>😕</div>
          <p>{error || '未找到该条目'}</p>
          <button onClick={() => void navigate('/')} className={styles.btnPrimary}>
            ← 返回图库
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.detailPage}>
      <div className={styles.contentShell}>
        <div className={styles.stickyTopBar}>
          <button onClick={() => void navigate(-1)} className={styles.backLink}>
            ← 返回图库
          </button>
        </div>

        <section className={styles.heroGrid}>
          <aside className={styles.primaryRail}>
            <SourceCard
              type={entry.type}
              pixivId={entry.pixivId}
              authorId={entry.authorId}
              authorName={entry.authorName}
              tags={entry.sourceTags}
              caption={entry.caption}
              createDate={entry.postDate}
              totalView={entry.views}
              totalBookmarks={entry.bookmarks}
              sourceUrl={entry.sourceUrl}
              onTagClick={handleNavigateByTag}
            />

            <div className={styles.sideCard}>
              <div className={styles.sideSectionTitle}>用户标签</div>
              <TagManager
                entryId={entry.id}
                currentTags={entry.userTagRecords}
                onTagClick={(tag) => handleNavigateByTag(tag.name)}
                onTagsChanged={(newTags: UserTag[]) => {
                  setEntry((prev) => prev ? {
                    ...prev,
                    userTagRecords: newTags,
                    userTags: newTags.map((t: UserTag) => t.name),
                  } : prev)
                }}
              />
            </div>

            {renderModelSection('LoRA 模型', 'lora', displayLoras, displayRemoteLoraCheck)}
            {renderModelSection('Checkpoint 模型', 'checkpoint', displayCheckpoints, displayRemoteCheckpointCheck)}

            <div className={styles.actionCard}>
              <button className={styles.btnPrimary} onClick={() => void handleToggleFavorite()}>
                {entry.isFavorited ? '取消收藏' : '加入收藏'}
              </button>
              <button className={styles.btnDanger} onClick={() => void handleDelete()}>
                删除条目
              </button>
            </div>
          </aside>

          <div className={styles.heroStage}>
            <div className={styles.stageHeader}>
              <div>
                <h1 className={styles.title}>{entry.displayTitle}</h1>
              </div>
              {entry.images.length > 0 && (
                <div className={styles.navigatorCluster}>
                  <button className={styles.btnSecondary} onClick={() => shiftImage(-1)} disabled={currentImageIndex <= 0}>
                    ← 上一张
                  </button>
                  <div className={styles.imageCounter}>当前图 #{(currentImage?.index ?? currentImageIndex) + 1} / {entry.images.length}</div>
                  <button className={styles.btnSecondary} onClick={() => shiftImage(1)} disabled={currentImageIndex >= entry.images.length - 1}>
                    下一张 →
                  </button>
                </div>
              )}
            </div>

            {currentImage ? (
              <div className={styles.stageCard}>
                <div className={styles.stageToolbar}>
                  <div className={styles.stageMeta}>
                    <span className={styles.focusBadge}>当前图片 #{currentImage.index + 1}</span>
                    <span className={styles.mutedMeta}>{entry.type} · 单图单 workflow</span>
                  </div>
                  <div className={styles.toolbarActions}>
                    <button className={styles.btnSecondary} onClick={() => setGalleryIndex(currentImageIndex)}>
                      放大查看
                    </button>
                      <button
                        className={styles.btnSecondary}
                        onClick={() =>
                          void navigate({
                            pathname: '/testing',
                            search: buildTestingSearch({
                              mode: testingMode,
                              entryId: entry.id,
                              imageIndex: currentImageIndex,
                            }),
                          })
                        }
                      >
                        发送到测试页
                      </button>
                  </div>
                </div>

                <div className={styles.stageViewport}>
                  {currentImageSrc ? (
                    <img src={currentImageSrc} alt={`Image ${currentImage.index + 1}`} className={styles.focusImage} />
                  ) : (
                    <div className={styles.imagePlaceholder}>当前图片没有可预览的本地资源</div>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.emptyStage}>此条目没有关联图片</div>
            )}
          </div>
        </section>

        <section className={styles.secondaryGrid}>
          <div className={styles.mainColumn}>
            {currentImage?.promptText && (
              <div className={styles.infoCard}>
                <div className={styles.cardHeader}>
                  <div>
                    <div className={styles.sectionLabel}>当前图提示词</div>
                  </div>
                  <button className={styles.btnSecondary} onClick={() => handleCopyText(currentImage.promptText)}>
                    复制提示词
                  </button>
                </div>
                <div className={styles.codeBlock}>{currentImage.promptText}</div>
              </div>
            )}

            {currentImage?.aiJson && (
              <div className={styles.infoCard}>
                <div className={styles.cardHeader}>
                  <div>
                    <div className={styles.sectionLabel}>当前图 Workflow 元数据</div>
                  </div>
                  <button className={styles.btnSecondary} onClick={() => handleCopyText(currentImage.aiJson)}>
                    复制 Workflow JSON
                  </button>
                </div>
                <div className={styles.codeBlock}>{currentImage.aiJson}</div>
              </div>
            )}

            <div className={styles.infoCard}>
              <div className={styles.cardHeader}>
                <div className={styles.sectionLabel}>LLM 分析结果</div>
              </div>
              <AnalysisPanel
                analysis={currentAnalysis}
                isAnalyzing={isAnalyzing}
                onAnalyze={() => void handleAnalyze()}
                onExportPreset={currentAnalysis ? () => setIsPresetModalOpen(true) : undefined}
              />
            </div>
          </div>

          <aside className={styles.sideColumn}>
            <div className={styles.infoCard}>
              <div className={styles.sectionLabel}>条目信息</div>
              <div className={styles.metaGrid}>
                <div><strong>类型:</strong> {entry.type}</div>
                <div><strong>图片数:</strong> {entry.images.length}</div>
                <div><strong>当前图:</strong> {currentImage ? `#${currentImage.index + 1}` : '无'}</div>
                <div><strong>收藏:</strong> {entry.isFavorited ? '是' : '否'}</div>
                <div><strong>入库时间:</strong> {new Date(entry.createdAt).toLocaleString('zh-CN')}</div>
                <div><strong>更新时间:</strong> {new Date(entry.updatedAt).toLocaleString('zh-CN')}</div>
                {entry.pixivId && <div><strong>Pixiv ID:</strong> {entry.pixivId}</div>}
                {entry.authorId && <div><strong>作者 ID:</strong> {entry.authorId}</div>}
              </div>
            </div>

            <div className={styles.infoCard}>
              <div className={styles.cardHeader}>
                <div className={styles.sectionLabel}>原始负载 (RAW JSON)</div>
              </div>
              <div className={styles.rawShell}>
                <RawPayload data={parsedRaw ?? entry.rawJson} title="Entry Raw Data" />
              </div>
            </div>
          </aside>
        </section>
      </div>

      {galleryIndex !== null && entry.images.length > 0 && (
        <ImageGallery images={entry.images} initialIndex={galleryIndex} onClose={() => setGalleryIndex(null)} />
      )}
      {isPresetModalOpen && currentAnalysis && currentImage && (
        <ExportPresetModal
          isOpen={isPresetModalOpen}
          entry={entry}
          image={currentImage}
          analysis={currentAnalysis}
          onClose={() => setIsPresetModalOpen(false)}
          onSaved={(preset) => {
            alert(`已保存提示词预设：${preset.name}`)
          }}
        />
      )}
    </div>
  )
}
