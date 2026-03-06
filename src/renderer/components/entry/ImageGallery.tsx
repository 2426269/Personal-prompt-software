import type { AitagImage } from '@shared/types/importer'
import { useCallback, useEffect, useState } from 'react'
import styles from './ImageGallery.module.css'

interface ImageGalleryProps {
  images: AitagImage[]
  initialIndex?: number
  onClose: () => void
}

export function ImageGallery({ images, initialIndex = 0, onClose }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
  }, [images.length])

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
  }, [images.length])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') handlePrev()
      if (e.key === 'ArrowRight') handleNext()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlePrev, handleNext, onClose])

  if (!images.length) return null

  const currentImage = images[currentIndex]
  const imgSrc = currentImage?.localPath
    ? `file://${currentImage.localPath}`
    : currentImage?.originalUrl

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.toolbar} onClick={(e) => e.stopPropagation()}>
        <div className={styles.counter}>
          {currentIndex + 1} / {images.length}
        </div>
        <button className={styles.closeBtn} onClick={onClose}>
          ✕ 关闭
        </button>
      </div>

      <div className={styles.mainArea} onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
        {images.length > 1 && (
          <button className={`${styles.navBtn} ${styles.prevBtn}`} onClick={handlePrev}>
            ‹
          </button>
        )}

        <div className={styles.imageContainer}>
          {imgSrc ? (
            <img src={imgSrc} alt={`Preview ${currentIndex + 1}`} className={styles.fullImage} />
          ) : (
            <div className={styles.placeholder}>暂无图片源</div>
          )}
        </div>

        {images.length > 1 && (
          <button className={`${styles.navBtn} ${styles.nextBtn}`} onClick={handleNext}>
            ›
          </button>
        )}
      </div>

      {images.length > 1 && (
        <div className={styles.thumbnailStrip} onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
          {images.map((img, idx) => {
            const thumbSrc = img.localPath ? `file://${img.localPath}` : img.originalUrl
            return (
              <div
                key={img.index}
                className={`${styles.thumbnail} ${idx === currentIndex ? styles.activeThumb : ''}`}
                onClick={() => setCurrentIndex(idx)}
              >
                {thumbSrc && <img src={thumbSrc} alt={`Thumb ${idx + 1}`} loading="lazy" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
