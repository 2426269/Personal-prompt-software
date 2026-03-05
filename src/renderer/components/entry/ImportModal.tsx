/* eslint-disable */
import { useState } from 'react'
import styles from './ImportModal.module.css'

type TabType = 'url' | 'paste' | 'file'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (entryId: string) => void
}

export function ImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('url')
  const [urlInput, setUrlInput] = useState('')
  const [pasteInput, setPasteInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (!isOpen) return null

  const handleImport = async () => {
    setIsSubmitting(true)
    setErrorMsg('')

    try {
      if (activeTab === 'url') {
        const api = window.api
        const res = await api.importFromAitag(urlInput)
        if (res.success && res.data?.entryId) {
          onSuccess(res.data.entryId)
          onClose()
        } else {
          setErrorMsg(res.error?.message || '抓取失败，请检查 URL。')
        }
      } else if (activeTab === 'paste') {
        // WIP: Implement later for raw parsing mapping to DB entries.
        // For Phase 1A, Codex exposed parse endpoints, but storing it is not yet fully exposed as a single "import" endpoint for raw text.
        // We will mock this or handle later.
        setErrorMsg('纯文本解析入库后端尚未实现一件连贯接口，目前只支持 Aitag URL 抓取。')
      } else {
        setErrorMsg('文件导入暂未实现。')
      }
    } catch (err: unknown) {
      const e = err as Error
      setErrorMsg(e.message || '导入时发生未知错误')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h2 className={styles.title}>添加提示词与作品</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </header>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'url' ? styles.active : ''}`}
            onClick={() => { setActiveTab('url'); setErrorMsg('') }}
          >
            URL 抓取
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'paste' ? styles.active : ''}`}
            onClick={() => { setActiveTab('paste'); setErrorMsg('') }}
          >
            文本解析
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'file' ? styles.active : ''}`}
            onClick={() => { setActiveTab('file'); setErrorMsg('') }}
          >
            文件上传
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === 'url' && (
            <div className={styles.inputGroup}>
              <label className={styles.label}>Aitag.win 作品链接或 Pixiv ID</label>
              <input
                type="text"
                className={styles.input}
                placeholder="https://aitag.win/i/141908098 或 141908098"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
            </div>
          )}

          {activeTab === 'paste' && (
            <div className={styles.inputGroup}>
              <label className={styles.label}>粘贴参数文本 (SD/NAI/ComfyUI 均可)</label>
              <textarea
                className={`${styles.input} ${styles.textarea} font-mono`}
                placeholder="在此处粘贴包含随机种子的魔法生成参数..."
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
              />
            </div>
          )}

          {activeTab === 'file' && (
            <div className={styles.fileArea}>
              <div>📁 点击或拖拽文件到此处</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                支持带有 Exif/PNG Chunk 元数据的图片，或 ComfyUI JSON 格式文件。
              </div>
            </div>
          )}

          {errorMsg && (
            <div className={`${styles.statusMessage} ${styles.statusError}`}>
              {errorMsg}
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          <button
            className={`${styles.btn} ${styles.btnCancel}`}
            onClick={onClose}
            disabled={isSubmitting}
          >
            取消
          </button>
          <button
            className={`${styles.btn} ${styles.btnSubmit}`}
            onClick={() => void handleImport()}
            disabled={isSubmitting || (activeTab === 'url' && !urlInput) || (activeTab === 'paste' && !pasteInput)}
          >
            {isSubmitting ? '处理中...' : '开始导入'}
          </button>
        </footer>
      </div>
    </div>
  )
}
