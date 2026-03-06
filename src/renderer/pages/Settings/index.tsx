import type { ImageCacheCleanupMode, ImageCacheCleanupResult, ImageCacheStatus } from '@shared/types/image-cache'
import { useCallback, useEffect, useState } from 'react'
import styles from './Settings.module.css'

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function Settings() {
  const [status, setStatus] = useState<ImageCacheStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCleaning, setIsCleaning] = useState(false)
  const [lastResult, setLastResult] = useState<ImageCacheCleanupResult | null>(null)
  
  const loadStatus = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await window.api.getImageCacheStatus()
      if (res.success && res.data) {
        setStatus(res.data)
      }
    } catch (err) {
      console.error('Failed to load cache status:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const handleCleanup = async (mode: ImageCacheCleanupMode) => {
    if (mode === 'all') {
      const confirm = window.confirm('⚠ 警告：此操作将清空所有本地图片缓存并断开数据库图片关联！若原始来源失效将无法恢复。\n如果您只想清理冗余文件，请选择另外两项功能。\n\n您确定要进行全量本地图片清空吗？')
      if (!confirm) return
    }

    try {
      setIsCleaning(true)
      setLastResult(null)
      const res = await window.api.cleanupImageCache({ mode })
      if (res.success && res.data) {
        setLastResult(res.data)
        // Refresh status after cleanup
        void loadStatus()
      } else {
        let errorMsg = '未知错误'
        if (res.error) {
          errorMsg = typeof res.error === 'string' ? res.error : (res.error.message || JSON.stringify(res.error))
        }
        alert(`清理失败: ${errorMsg}`)
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      alert(`清理出错: ${errorMsg}`)
    } finally {
      setIsCleaning(false)
    }
  }

  return (
    <div className={styles.settingsPage}>
      <h1 className={styles.title}>系统设置</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>图片缓存管理</h2>
        
        {isLoading && !status ? (
          <div className={styles.loading}>正在计算缓存占用...</div>
        ) : status ? (
          <>
            <div className={styles.cacheGrid}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>总占用空间</div>
                <div className={styles.statValue}>{formatBytes(status.totalBytes)}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>物理文件总数</div>
                <div className={styles.statValue}>{status.fileCount} 个</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>被引用的有效文件</div>
                <div className={styles.statValue}>{status.referencedFileCount} 个</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>无引用的幽灵文件 (Orphans)</div>
                <div className={`${styles.statValue} ${status.orphanFileCount > 0 ? styles.warning : ''}`}>
                  {status.orphanFileCount} 个 ({formatBytes(status.orphanBytes)})
                </div>
              </div>
            </div>

            {status.missingReferenceCount > 0 && (
              <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', border: '1px solid var(--status-warning)', borderRadius: 'var(--radius-sm)', color: 'var(--status-warning)', fontSize: '13px' }}>
                ⚠ 数据库中有 {status.missingReferenceCount} 条图片记录的指向本地文件不存在（物理丢失）。
              </div>
            )}

            <div className={styles.actions}>
              <div className={styles.actionRow}>
                <div className={styles.actionDesc}>
                  <div className={styles.actionTitle}>清理幽灵缓存 (Orphans)</div>
                  <div className={styles.actionSub}>删除硬盘上存在但数据库中没有任何记录引用的孤儿文件，安全释放空间。</div>
                </div>
                <button 
                  className={styles.btnAction} 
                  onClick={() => void handleCleanup('orphans')}
                  disabled={isCleaning || status.orphanFileCount === 0}
                >
                  {isCleaning ? '清理中...' : '清理幽灵缓存'}
                </button>
              </div>

              <div className={styles.actionRow}>
                <div className={styles.actionDesc}>
                  <div className={styles.actionTitle}>修复失效引用 (Missing Refs)</div>
                  <div className={styles.actionSub}>清理数据库中指向失效或丢失的本地文件路径的关联引用（将其置回未缓存状态）。</div>
                </div>
                <button 
                  className={styles.btnAction} 
                  onClick={() => void handleCleanup('missing_refs')}
                  disabled={isCleaning || status.missingReferenceCount === 0}
                >
                  {isCleaning ? '修复中...' : '修复失效引用'}
                </button>
              </div>

              <div className={styles.actionRow} style={{ marginTop: 'var(--space-2)' }}>
                <div className={styles.actionDesc}>
                  <div className={styles.actionTitle} style={{ color: 'var(--status-error)' }}>危险：全量清空所有缓存 (All)</div>
                  <div className={styles.actionSub}>彻底清空所有本地图片文件，并清空数据库中所有的本地关联。仅在极端空间不足时使用。</div>
                </div>
                <button 
                  className={`${styles.btnAction} ${styles.btnDanger}`} 
                  onClick={() => void handleCleanup('all')}
                  disabled={isCleaning}
                >
                  清空全部库
                </button>
              </div>
            </div>

            {lastResult && (
              <div className={styles.resultBox}>
                <strong>✅ 清理完成:</strong><br />
                {lastResult.mode === 'orphans' && `释放了 ${formatBytes(lastResult.freedBytes)} 空间，删除了 ${lastResult.deletedFiles} 个幽灵文件。`}
                {lastResult.mode === 'missing_refs' && `移除了 ${lastResult.clearedReferences} 条失效的数据库内联引用。`}
                {lastResult.mode === 'all' && `删除了 ${lastResult.deletedFiles} 个缓存文件，清空了 ${lastResult.clearedReferences} 条数据库关联，共释放 ${formatBytes(lastResult.freedBytes)} 空间。`}
              </div>
            )}
          </>
        ) : (
          <div className={styles.loading}>无法读取缓存状态数据。</div>
        )}
      </section>
    </div>
  )
}
