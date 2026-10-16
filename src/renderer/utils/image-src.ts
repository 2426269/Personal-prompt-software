import type { AitagImage } from '@shared/types/importer'

export function toImageSrc(image: Pick<AitagImage, 'localPath' | 'originalUrl'> | null | undefined): string | null {
  if (!image) {
    return null
  }

  if (typeof image.localPath === 'string' && image.localPath.length > 0) {
    const normalizedPath = image.localPath.replace(/\\/g, '/')
    const absolutePath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
    return encodeURI(`file://${absolutePath}`)
  }

  if (typeof image.originalUrl === 'string' && image.originalUrl.length > 0) {
    return image.originalUrl
  }

  return null
}
