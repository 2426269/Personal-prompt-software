import { AnalysisPanel } from '@renderer/components/entry/AnalysisPanel'
import { ImageGallery } from '@renderer/components/entry/ImageGallery'
import { TagManager } from '@renderer/components/entry/TagManager'
import type { EntryDetail } from '@shared/types/entry'
import type { UserTag } from '@shared/types/tag'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RawPayload } from '../../components/entry/RawPayload'
import { SourceCard } from '../../components/entry/SourceCard'
import styles from './Detail.module.css'

export function Detail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const api = window.api

  const [entry, setEntry] = useState<EntryDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const fetchEntry = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    setError('')
    try {
      const res = await api.getEntry(id)
      if (res.success && res.data) {
        setEntry(res.data)
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

  const handleCopyPrompt = (text: string) => {
    void navigator.clipboard.writeText(text)
  }

  const handleAnalyze = async () => {
    if (!entry) return
    try {
      setIsAnalyzing(true)
      const res = await api.analyzeEntry({ entryId: entry.id })
      if (res.success && res.data) {
        const analysisResult = res.data.analysis
        setEntry((prev) => prev ? { ...prev, analysis: analysisResult } : prev)
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

  // Parse rawJson to extract prompt data
  const parsedRaw = entry?.rawJson ? (() => {
    try {
      return JSON.parse(entry.rawJson) as Record<string, unknown>
    } catch {
      return null
    }
  })() : null

  if (isLoading) {
    return (
      <div className={styles.detailPage}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          ⏳ 加载中...
        </div>
      </div>
    )
  }

  if (error || !entry) {
    return (
      <div className={styles.detailPage}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', gap: '16px' }}>
          <div style={{ fontSize: '48px' }}>😕</div>
          <p>{error || '未找到该条目'}</p>
          <button onClick={() => void navigate('/')} className={styles.btnPrimary}>
            ← 返回图库
          </button>
        </div>
      </div>
    )
  }

  // Extract first image prompt text for display
  const firstImage = entry.images[0]
  const promptText = firstImage?.promptText ?? ''

  return (
    <div className={styles.detailPage}>
      {/* Left Column: Source & Prompts */}
      <aside className={styles.leftColumn}>
        <button
          onClick={() => void navigate(-1)}
          style={{ color: 'var(--accent-blue)', textAlign: 'left', marginBottom: 'var(--space-2)' }}
        >
          ← 返回图库
        </button>

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
        />

        {promptText && (
          <div>
            <h3 className={styles.sectionTitle}>提示词 (Prompt)</h3>
            <div
              className={styles.card}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
            >
              {promptText}
            </div>
            <button
              className={styles.btnSecondary}
              style={{ marginTop: '8px' }}
              onClick={() => handleCopyPrompt(promptText)}
            >
              📋 复制提示词
            </button>
          </div>
        )}

        {/* User Tags — interactive */}
        <div>
          <h3 className={styles.sectionTitle}>用户标签</h3>
          <TagManager
            entryId={entry.id}
            currentTags={entry.userTagRecords}
            onTagsChanged={(newTags: UserTag[]) => {
              setEntry((prev) => prev ? {
                ...prev,
                userTagRecords: newTags,
                userTags: newTags.map((t: UserTag) => t.name),
              } : prev)
            }}
          />
        </div>

        {/* Loras */}
        {entry.loras.length > 0 && (
          <div>
            <h3 className={styles.sectionTitle}>LoRA 模型</h3>
            <div className={styles.tagList}>
              {entry.loras.map((lora) => (
                <span key={lora.text} className={styles.loraPill}>
                  {lora.text}
                  {lora.weight != null && lora.weight !== 1 && (
                    <span style={{ opacity: 0.6 }}>:{lora.weight}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          <button
            className={styles.btnPrimary}
            onClick={() => void handleToggleFavorite()}
          >
            {entry.isFavorited ? '💔 取消收藏' : '❤️ 加入收藏'}
          </button>
          <button
            className={styles.btnDanger}
            onClick={() => void handleDelete()}
          >
            🗑️ 删除
          </button>
        </div>
      </aside>

      {/* Center: Image Gallery */}
      <main className={styles.workspace}>
        <h2 style={{ marginTop: 0 }}>{entry.displayTitle}</h2>
        {entry.images.length > 0 ? (
          <div className={styles.imageGrid}>
            {entry.images.map((img, idx) => (
              <div
                key={img.index}
                className={styles.imageCard}
                onClick={() => setGalleryIndex(idx)}
                style={{ cursor: 'pointer' }}
              >
                {img.localPath ? (
                  <img
                    src={`file://${img.localPath}`}
                    alt={`Image ${idx + 1}`}
                    className={styles.imagePreview}
                  />
                ) : img.originalUrl ? (
                  <img
                    src={img.originalUrl}
                    alt={`Image ${idx + 1}`}
                    className={styles.imagePreview}
                    loading="lazy"
                  />
                ) : (
                  <div className={styles.imagePlaceholder}>🖼️ 图片 {idx + 1}</div>
                )}
                <div className={styles.imageIndex}>#{img.index}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.card} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', backgroundColor: 'transparent' }}>
            <p style={{ color: 'var(--text-secondary)' }}>此条目没有关联图片</p>
          </div>
        )}

        {/* LLM Analysis Results */}
        <h3 style={{ marginTop: 'var(--space-4)' }}>🧠 LLM 分析结果</h3>
        <AnalysisPanel
          analysis={entry.analysis}
          isAnalyzing={isAnalyzing}
          onAnalyze={() => void handleAnalyze()}
        />
      </main>

      {/* Right Column: Metadata & Raw */}
      <aside className={styles.rightColumn}>
        <div>
          <h3 className={styles.sectionTitle}>条目信息</h3>
          <div className={styles.card}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', fontSize: '13px' }}>
              <div><strong>类型:</strong> {entry.type}</div>
              <div><strong>图片数:</strong> {entry.images.length}</div>
              <div><strong>入库时间:</strong> {new Date(entry.createdAt).toLocaleString('zh-CN')}</div>
              <div><strong>更新时间:</strong> {new Date(entry.updatedAt).toLocaleString('zh-CN')}</div>
              {entry.pixivId && <div><strong>Pixiv ID:</strong> {entry.pixivId}</div>}
              {entry.authorId && <div><strong>作者 ID:</strong> {entry.authorId}</div>}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <h3 className={styles.sectionTitle}>原始负载 (Raw JSON)</h3>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <RawPayload data={parsedRaw ?? entry.rawJson} title="Entry Raw Data" />
          </div>
        </div>
      </aside>

      {/* Image Gallery Lightbox */}
      {galleryIndex !== null && entry.images.length > 0 && (
        <ImageGallery
          images={entry.images}
          initialIndex={galleryIndex}
          onClose={() => setGalleryIndex(null)}
        />
      )}
    </div>
  )
}
