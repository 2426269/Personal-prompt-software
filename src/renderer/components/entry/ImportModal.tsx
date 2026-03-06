import { useRef, useState } from 'react'
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const api = window.api

  const handleImport = async () => {
    setIsSubmitting(true)
    setErrorMsg('')

    try {
      if (activeTab === 'url') {
        const res = await api.importFromAitag(urlInput)
        if (res.success && res.data?.entryId) {
          onSuccess(res.data.entryId)
          onClose()
        } else {
          setErrorMsg(res.error?.message ?? '抓取失败，请检查 URL。')
        }
      } else if (activeTab === 'paste') {
        if (!pasteInput.trim()) {
          setErrorMsg('请先粘贴提示词文本。')
          return
        }
        const res = await api.importFromText(pasteInput)
        if (res.success && res.data?.entryId) {
          onSuccess(res.data.entryId)
          onClose()
        } else {
          setErrorMsg(res.error?.message ?? '文本解析失败，请检查格式。')
        }
      } else if (activeTab === 'file') {
        if (!selectedFile) {
          setErrorMsg('请先选择一个文件。')
          return
        }
        // Electron File objects have a .path property with the absolute path
        const filePath = (selectedFile as unknown as { path: string }).path
        const res = await api.importFromFile(filePath)
        if (res.success && res.data?.entryId) {
          onSuccess(res.data.entryId)
          onClose()
        } else {
          setErrorMsg(res.error?.message ?? '文件解析失败。')
        }
      }
    } catch (err: unknown) {
      const e = err as Error
      setErrorMsg(e.message || '导入时发生未知错误')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] ?? null)
  }

  const isDisabled =
    isSubmitting ||
    (activeTab === 'url' && !urlInput) ||
    (activeTab === 'paste' && !pasteInput) ||
    (activeTab === 'file' && !selectedFile)

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
                className={`${styles.input} ${styles.textarea}`}
                style={{ fontFamily: 'var(--font-mono)' }}
                placeholder={'在此处粘贴 AI 生图参数文本...\n支持 NAI / Stable Diffusion / ComfyUI 格式'}
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
              />
            </div>
          )}

          {activeTab === 'file' && (
            <div className={styles.inputGroup}>
              <label className={styles.label}>选择本地图片或 JSON/TXT 文件</label>
              <div
                className={styles.fileArea}
                onClick={handleFileClick}
              >
                <div>📁 点击选择文件</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  支持 .png / .jpg / .webp (读取 Exif 元数据) 或 .json / .txt
                </div>
                {selectedFile && (
                  <div style={{ marginTop: '8px', color: 'var(--accent-blue)', fontWeight: 500 }}>
                    已选择: {selectedFile.name}
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.json,.png,.jpg,.jpeg,.webp"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
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
            disabled={isDisabled}
          >
            {isSubmitting ? '处理中...' : '开始导入'}
          </button>
        </footer>
      </div>
    </div>
  )
}
