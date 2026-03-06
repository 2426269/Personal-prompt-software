import fs from 'node:fs/promises'
import path from 'node:path'

import ExifReader from 'exifreader'

import type { PromptSourceType } from '@shared/types/importer'
import { EntriesRepository } from '../../db/repositories/entries.repo'
import { PromptTypeDetector } from './auto-detect'
import { ComfyUIParser } from './comfyui-parser'
import { NAIParser } from './nai-parser'
import { SDParser } from './sd-parser'

export class LocalImportService {
  constructor(
    private readonly detector = new PromptTypeDetector(),
    private readonly naiParser = new NAIParser(),
    private readonly sdParser = new SDParser(),
    private readonly comfyuiParser = new ComfyUIParser(),
    private readonly entriesRepository = new EntriesRepository(),
  ) {}

  async importFromText(text: string): Promise<{ entryId: string; type: PromptSourceType; parsed: unknown }> {
    const detectResult = await Promise.resolve(this.detector.detect(text))
    let parsed: unknown
    let title = 'Local Text Import'

    if (detectResult.type === 'NAI') {
      parsed = this.naiParser.parse(text)
      title = 'NAI Text Prompt'
    } else if (detectResult.type === 'SD') {
      parsed = this.sdParser.parse(text)
      title = 'SD Text Prompt'
    } else if (detectResult.type === 'ComfyUI') {
      parsed = this.comfyuiParser.parse(text)
      title = 'ComfyUI Workflow'
    } else {
      throw new Error(`无法识别或不支持的提示词格式: ${detectResult.type}`)
    }

    const entryId = this.entriesRepository.upsert({
      pixivId: '',
      authorId: '',
      title: `${title} - ${new Date().toLocaleString()}`,
      caption: '通过粘贴/文件导入',
      type: detectResult.type,
      tags: [],
      sourceUrl: 'local',
      postDate: new Date().toISOString(),
      views: 0,
      bookmarks: 0,
      rawJson: JSON.stringify(parsed),
    })

    return { entryId, type: detectResult.type, parsed }
  }

  async importFromFile(filePath: string): Promise<{ entryId: string; type: PromptSourceType; parsed: unknown }> {
    const ext = path.extname(filePath).toLowerCase()
    let text = ''

    if (ext === '.json' || ext === '.txt') {
      text = await fs.readFile(filePath, 'utf-8')
    } else if (ext === '.png' || ext === '.webp' || ext === '.jpeg' || ext === '.jpg') {
      const buffer = await fs.readFile(filePath)
      const tags = ExifReader.load(buffer)
      
      const parameters = tags['parameters']?.description || tags['Comment']?.description || tags['Description']?.description || tags['Software']?.description
      const comfyPrompt = tags['prompt']?.description
      const comfyWorkflow = tags['workflow']?.description

      if (comfyWorkflow || comfyPrompt) {
        text = comfyWorkflow ? comfyWorkflow : comfyPrompt
      } else if (parameters) {
        text = parameters
      } else {
        throw new Error('图片中没有找到 AI 生成器的元数据信息 (Exif/PNG Chunk).')
      }
    } else {
      throw new Error(`不支持的文件格式: ${ext}`)
    }

    // Reuse text import but update caption
    const result = await this.importFromText(text)
    
    // Optionally update title to use filename
    // We can do it broadly or let the user edit later.
    
    return result
  }
}
