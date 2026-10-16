import fs from 'node:fs/promises'
import path from 'node:path'

import { app } from 'electron'

import type { AitagImage } from '@shared/types/importer'

type SupportedImageExtension = 'gif' | 'jpg' | 'png' | 'webp'

interface DownloadedImagePayload {
  buffer: Buffer
  extension: SupportedImageExtension
}

function detectImageExtension(
  contentType: string | null,
  buffer: Buffer,
  sourceUrl: string,
): SupportedImageExtension | null {
  const normalizedContentType = contentType?.toLowerCase() ?? ''

  if (normalizedContentType.startsWith('image/')) {
    if (normalizedContentType.includes('webp')) return 'webp'
    if (normalizedContentType.includes('png')) return 'png'
    if (normalizedContentType.includes('jpeg') || normalizedContentType.includes('jpg')) return 'jpg'
    if (normalizedContentType.includes('gif')) return 'gif'
  }

  if (buffer.length >= 12) {
    if (buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return 'png'
    if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'jpg'
    if (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'webp'
    }
    if (
      buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
      buffer.subarray(0, 6).toString('ascii') === 'GIF89a'
    ) {
      return 'gif'
    }
  }

  const leadingText = buffer.subarray(0, 64).toString('utf8').trimStart().toLowerCase()
  if (leadingText.startsWith('<!doctype html') || leadingText.startsWith('<html')) {
    return null
  }

  const pathname = new URL(sourceUrl).pathname.toLowerCase()
  if (pathname.endsWith('.webp')) return 'webp'
  if (pathname.endsWith('.png')) return 'png'
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'jpg'
  if (pathname.endsWith('.gif')) return 'gif'

  return null
}

export class ImageCacheDownloader {
  private readonly cacheRoot: string

  constructor(cacheRoot?: string) {
    this.cacheRoot = cacheRoot ?? path.join(app.getPath('userData'), 'cache', 'aitag')
  }

  async download(pixivId: string, images: AitagImage[]): Promise<AitagImage[]> {
    const targetDir = path.join(this.cacheRoot, pixivId)
    await fs.mkdir(targetDir, { recursive: true })

    const results = await Promise.all(
      images.map(async (image) => {
        if (!image.originalUrl) {
          return image
        }

        try {
          const downloaded = await this.downloadSingle(image.originalUrl)
          await this.removeExistingVariants(targetDir, image.index)

          const filePath = path.join(targetDir, `${image.index}.${downloaded.extension}`)
          await fs.writeFile(filePath, downloaded.buffer)

          return {
            ...image,
            localPath: filePath,
          }
        } catch {
          return {
            ...image,
            localPath: null,
          }
        }
      }),
    )

    return results
  }

  private async removeExistingVariants(targetDir: string, imageIndex: number): Promise<void> {
    const extensions: SupportedImageExtension[] = ['gif', 'jpg', 'png', 'webp']

    await Promise.all(
      extensions.map(async (extension) => {
        const filePath = path.join(targetDir, `${imageIndex}.${extension}`)
        try {
          await fs.unlink(filePath)
        } catch {
          // Ignore old variants that do not exist.
        }
      }),
    )
  }

  private async downloadSingle(url: string): Promise<DownloadedImagePayload> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const referer = new URL(url).hostname.endsWith('pximg.net')
      ? 'https://www.pixiv.net/'
      : 'https://aitag.win/'

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          referer,
          'user-agent': 'PromptForge/0.1',
        },
      })

      if (!response.ok) {
        throw new Error(`image download failed: ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const extension = detectImageExtension(response.headers.get('content-type'), buffer, url)

      if (!extension) {
        throw new Error('image download returned non-image content')
      }

      return { buffer, extension }
    } finally {
      clearTimeout(timeout)
    }
  }
}
