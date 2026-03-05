import fs from 'node:fs/promises'
import path from 'node:path'

import { app } from 'electron'

import type { AitagImage } from '@shared/types/importer'

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
        const extension = image.originalUrl.toLowerCase().endsWith('.png') ? 'png' : 'webp'
        const filePath = path.join(targetDir, `${image.index}.${extension}`)

        try {
          await this.downloadSingle(image.originalUrl, filePath)
          return {
            ...image,
            localPath: filePath,
          }
        } catch {
          return image
        }
      }),
    )

    return results
  }

  private async downloadSingle(url: string, targetPath: string): Promise<void> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          referer: 'https://aitag.win/',
        },
      })

      if (!response.ok) {
        throw new Error(`image download failed: ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      await fs.writeFile(targetPath, Buffer.from(arrayBuffer))
    } finally {
      clearTimeout(timeout)
    }
  }
}
