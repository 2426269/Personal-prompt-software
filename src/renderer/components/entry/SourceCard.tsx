import type { PromptSourceType } from '@shared/types/importer'
import styles from './SourceCard.module.css'

interface SourceCardProps {
  type: PromptSourceType
  modelName?: string | null
  pixivId?: string | null
  authorId?: string | null
  authorName?: string | null
  tags?: string[]
  caption?: string | null
  createDate?: string | null
  totalView?: number | null
  totalBookmarks?: number | null
  sourceUrl?: string | null
}

const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  NAI: { label: 'NovelAI', className: styles.nai },
  SD: { label: 'Stable Diffusion', className: styles.sd },
  ComfyUI: { label: 'ComfyUI Workflow', className: styles.comfyui },
  Unknown: { label: 'Unknown Source', className: styles.unknown },
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export function SourceCard({
  type,
  modelName,
  pixivId,
  authorId,
  authorName,
  tags,
  caption,
  createDate,
  totalView,
  totalBookmarks,
  sourceUrl,
}: SourceCardProps) {
  const config = TYPE_CONFIG[type] ?? TYPE_CONFIG.Unknown

  return (
    <div className={styles.sourceCard}>
      {/* Header: type indicator + label + model */}
      <div className={styles.sourceHeader}>
        <div className={`${styles.indicator} ${config.className}`} />
        <span className={styles.typeLabel}>{config.label}</span>
        {modelName && <span className={styles.modelName}>{modelName}</span>}
      </div>

      {/* Pixiv ID / Author */}
      {(pixivId || authorId || authorName) && (
        <>
          {pixivId && (
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Pixiv ID</span>
              {sourceUrl ? (
                <a
                  className={styles.metaLink}
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {pixivId}
                </a>
              ) : (
                <span className={styles.metaValue}>{pixivId}</span>
              )}
            </div>
          )}
          {(authorId || authorName) && (
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>作者</span>
              <span className={styles.metaValue}>
                {authorName ?? authorId}
              </span>
            </div>
          )}
        </>
      )}

      {/* Tags Pills */}
      {tags && tags.length > 0 && (
        <div className={styles.tagsContainer}>
          {tags.slice(0, 15).map((tag) => (
            <span key={tag} className={styles.tagPill}>
              {tag}
            </span>
          ))}
          {tags.length > 15 && (
            <span className={styles.tagPill}>+{tags.length - 15}</span>
          )}
        </div>
      )}

      {/* Caption / Description */}
      {caption && (
        <div className={styles.caption}>{caption}</div>
      )}

      {/* Date + View/Bookmark Stats */}
      {(createDate || totalView != null || totalBookmarks != null) && (
        <div className={styles.statsRow}>
          {createDate && (
            <div className={styles.statItem}>
              <span className={styles.statIcon}>📅</span>
              <span>{formatDate(createDate)}</span>
            </div>
          )}
          {totalView != null && (
            <div className={styles.statItem}>
              <span className={styles.statIcon}>👁</span>
              <span>{totalView.toLocaleString()}</span>
            </div>
          )}
          {totalBookmarks != null && (
            <div className={styles.statItem}>
              <span className={styles.statIcon}>❤️</span>
              <span>{totalBookmarks.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
