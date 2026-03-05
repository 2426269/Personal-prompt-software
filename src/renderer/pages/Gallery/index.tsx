import type { AitagImage } from '@shared/types/importer'
import { useState } from 'react'
import { ImportModal } from '../../components/entry/ImportModal'
import styles from './Gallery.module.css'

export function Gallery() {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  
  // Placeholder state for images
  const [images] = useState<AitagImage[]>([])

  const handleImportSuccess = (entryId: string) => {
    console.log('Successfully imported entry:', entryId)
    // TODO: Refresh gallery list from DB via IPC
  }

  return (
    <div className={styles.galleryPage}>
      <header className={styles.header}>
        <h1 className={styles.title}>图库浏览</h1>
        <div className={styles.actions}>
          <input 
            type="text" 
            placeholder="搜索提示词、模型、作者..." 
            className={styles.searchBar} 
          />
          <button 
            className={styles.importBtn}
            onClick={() => setIsImportModalOpen(true)}
          >
            <span>+</span>
            <span>导入 / 抓取</span>
          </button>
        </div>
      </header>

      {images.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🖼️</div>
          <h2>图库是空的</h2>
          <p>点击右上角的导入按钮，添加您的第一条提示词或作品</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {/* TODO: Map images to Masonry cards */}
        </div>
      )}

      <ImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={handleImportSuccess}
      />
    </div>
  )
}
