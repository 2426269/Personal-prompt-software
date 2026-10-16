import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { app, BrowserWindow } from 'electron'

import type {
  SpellbookCategory,
  SpellbookEntryDetail,
  SpellbookEntrySummary,
  SpellbookLibraryStatus,
  SpellbookListParams,
  SpellbookRelatedLink,
  SpellbookSection,
  SpellbookSyncResult,
} from '@shared/types/spellbook'

import {
  SpellbookRepository,
  type StoredSpellbookEntry,
  type StoredSpellbookImage,
} from '../../db/repositories/spellbook.repo'
import { AppError } from '../../ipc/wrap-ipc'

const SPELLBOOK_ROOT_URL = 'https://nai4.top/%E6%B3%95%E5%85%B8/%E6%B3%95%E5%85%B8%E7%9B%AE%E5%BD%95/'
const SPELLBOOK_SITE_ORIGIN = 'https://nai4.top'
const SPELLBOOK_DIRNAME = 'spellbook-library'
const SPELLBOOK_IMAGES_DIRNAME = 'images'
const MAX_CHILD_LINKS = 6
const MAX_IMAGES_PER_ENTRY = 8

interface DirectoryItem {
  title: string
  summary: string
  url: string
  isInternal: boolean
}

interface DetailImage {
  url: string
  caption: string | null
}

interface DetailPageContent {
  title: string
  summary: string
  sections: SpellbookSection[]
  bodyText: string
  promptCandidates: string[]
  links: SpellbookRelatedLink[]
  images: DetailImage[]
}

interface CrawlResult {
  entries: StoredSpellbookEntry[]
  images: StoredSpellbookImage[]
}

function getLibraryRootPath(): string {
  return path.join(app.getPath('userData'), SPELLBOOK_DIRNAME)
}

function getLibraryImagesPath(): string {
  return path.join(getLibraryRootPath(), SPELLBOOK_IMAGES_DIRNAME)
}

function normalizeUrl(rawUrl: string): string {
  const resolved = new URL(rawUrl, SPELLBOOK_SITE_ORIGIN)
  resolved.hash = ''
  return resolved.toString()
}

function isInternalSpellbookUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl, SPELLBOOK_SITE_ORIGIN)
    return url.origin === SPELLBOOK_SITE_ORIGIN
  } catch {
    return false
  }
}

function stableEntryId(url: string): string {
  return `spellbook_${createHash('sha1').update(url).digest('hex').slice(0, 16)}`
}

function inferCategory(title: string, summary: string, sourceUrl: string): SpellbookCategory {
  const text = `${title} ${summary} ${sourceUrl}`.toLowerCase()
  if (/(tag|人物|角色|服装|character)/.test(text)) {
    return 'tag_reference'
  }
  if (/(工具|网盘|notion|docs|doc|google|mega)/.test(text) || !isInternalSpellbookUrl(sourceUrl)) {
    return 'tool_nav'
  }
  return 'style_prompt'
}

function inferModelHints(...values: string[]): string[] {
  const text = values.join(' ').toLowerCase()
  const hints = new Set<string>()
  if (/(nai4|novelai4)/.test(text)) hints.add('NAI4')
  if (/(nai3|novelai v3|novelaiv3)/.test(text)) hints.add('NAI3')
  if (/(novelai v2|nai2)/.test(text)) hints.add('NAI2')
  if (/(noobai|illustrious|pony)/.test(text)) hints.add('SD/NoobAI/Pony')
  if (/(comfyui|stable diffusion|sdxl|sd1\.5|sd\b)/.test(text)) hints.add('ComfyUI/SD')
  return [...hints]
}

function inferTags(title: string, summary: string): string[] {
  const text = `${title} ${summary}`
  const candidates = ['融合', '画风', '画师串', '人物', '角色', '服装', 'tag', '工具', '参考图']
  return candidates.filter((tag) => text.toLowerCase().includes(tag.toLowerCase()))
}

function ensureLibraryDirs(): void {
  fs.mkdirSync(getLibraryRootPath(), { recursive: true })
  fs.rmSync(getLibraryImagesPath(), { recursive: true, force: true })
  fs.mkdirSync(getLibraryImagesPath(), { recursive: true })
}

function createCrawlerWindow(): BrowserWindow {
  const browser = new BrowserWindow({
    show: false,
    width: 1400,
    height: 1000,
    webPreferences: {
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  })
  browser.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  return browser
}

async function loadUrl(browser: BrowserWindow, url: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new AppError('SPELLBOOK_LOAD_TIMEOUT', `页面加载超时：${url}`))
    }, 60000)

    const handleFail = (_event: unknown, _code: number, description: string) => {
      cleanup()
      reject(new AppError('SPELLBOOK_LOAD_FAILED', `页面加载失败：${description || url}。如果开启了 VPN，请先关闭后重试。`))
    }

    const handleFinish = () => {
      cleanup()
      resolve()
    }

    const cleanup = () => {
      clearTimeout(timeout)
      browser.webContents.removeListener('did-fail-load', handleFail)
      browser.webContents.removeListener('did-finish-load', handleFinish)
    }

    browser.webContents.on('did-fail-load', handleFail)
    browser.webContents.on('did-finish-load', handleFinish)
    void browser.loadURL(url)
  })
}

async function extractDirectoryItems(browser: BrowserWindow): Promise<DirectoryItem[]> {
  return browser.webContents.executeJavaScript(`
    (() => {
      const normalize = (value) => (value || '').replace(/\\s+/g, ' ').trim();
      const main = document.querySelector('main') || document.body;
      const clone = main.cloneNode(true);
      clone.querySelectorAll('nav, aside, script, style, noscript, button').forEach((node) => node.remove());

      const seen = new Set();
      const items = [];

      for (const anchor of clone.querySelectorAll('a[href]')) {
        const href = anchor.getAttribute('href');
        if (!href) continue;
        const url = new URL(href, location.href).toString();
        if (url === location.href || url.startsWith(location.href + '#')) continue;

        const block = anchor.closest('a, article, section, div, li') || anchor;
        const title =
          normalize(block.querySelector('h1, h2, h3, h4, strong')?.textContent) ||
          normalize(anchor.textContent);
        if (!title || title.length > 120) continue;

        const paragraphs = Array.from(block.querySelectorAll('p'))
          .map((node) => normalize(node.textContent))
          .filter(Boolean);
        const summary = paragraphs.find((text) => text !== title) || '';
        const dedupeKey = url + '|' + title;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        items.push({
          title,
          summary,
          url,
          isInternal: new URL(url).origin === location.origin,
        });
      }

      return items;
    })()
  `, true) as Promise<DirectoryItem[]>
}

async function extractDetailContent(browser: BrowserWindow): Promise<DetailPageContent> {
  return browser.webContents.executeJavaScript(`
    (() => {
      const normalize = (value) => (value || '').replace(/\\s+/g, ' ').trim();
      const looksLikePrompt = (text) => {
        const value = normalize(text);
        if (!value || value.length < 24 || value.length > 1600) return false;
        const lower = value.toLowerCase();
        if (lower.includes('[artist:') || lower.includes('artist:')) return true;
        const commaCount = (value.match(/,/g) || []).length;
        const asciiWordCount = (value.match(/[a-z][a-z0-9:_-]*/ig) || []).length;
        return commaCount >= 4 && asciiWordCount >= 6;
      };

      const main = document.querySelector('main') || document.body;
      const clone = main.cloneNode(true);
      clone.querySelectorAll('nav, aside, script, style, noscript, button').forEach((node) => node.remove());

      const title = normalize(clone.querySelector('h1')?.textContent) || normalize(document.title);
      const sections = [];
      let current = { heading: '概览', blocks: [] };

      for (const node of clone.querySelectorAll('h2, h3, p, li, blockquote, pre, code, table')) {
        const text = normalize(node.textContent);
        if (!text || text === title) continue;

        if (node.matches('h2, h3')) {
          if (current.blocks.length > 0 || current.heading !== '概览') {
            sections.push(current);
          }
          current = { heading: text, blocks: [] };
          continue;
        }

        current.blocks.push(text);
      }

      if (current.blocks.length > 0 || current.heading !== '概览') {
        sections.push(current);
      }

      const allBlocks = sections.flatMap((section) => section.blocks);
      const summary = allBlocks.find(Boolean) || '';
      const promptCandidates = [];
      const seenPrompts = new Set();
      for (const node of clone.querySelectorAll('pre, code, blockquote, p, li, td')) {
        const text = normalize(node.textContent);
        if (!looksLikePrompt(text) || seenPrompts.has(text)) continue;
        seenPrompts.add(text);
        promptCandidates.push(text);
        if (promptCandidates.length >= 8) break;
      }

      const links = [];
      const seenLinks = new Set();
      for (const anchor of clone.querySelectorAll('a[href]')) {
        const href = anchor.getAttribute('href');
        if (!href) continue;
        const url = new URL(href, location.href).toString();
        if (url === location.href || url.startsWith(location.href + '#')) continue;
        const titleText = normalize(anchor.textContent) || url;
        const key = url + '|' + titleText;
        if (seenLinks.has(key)) continue;
        seenLinks.add(key);
        links.push({
          title: titleText,
          url,
          isInternal: new URL(url).origin === location.origin,
        });
      }

      const images = [];
      const seenImages = new Set();
      for (const image of clone.querySelectorAll('img')) {
        const src = image.currentSrc || image.getAttribute('src') || image.getAttribute('data-src');
        if (!src) continue;
        const url = new URL(src, location.href).toString();
        if (seenImages.has(url)) continue;
        seenImages.add(url);
        images.push({
          url,
          caption: normalize(image.getAttribute('alt')) || null,
        });
      }

      return {
        title,
        summary,
        sections,
        bodyText: allBlocks.join('\\n\\n'),
        promptCandidates,
        links,
        images,
      };
    })()
  `, true) as Promise<DetailPageContent>
}

async function fetchBinaryThroughPage(browser: BrowserWindow, url: string): Promise<{ contentType: string | null; data: Buffer }> {
  const payload: unknown = await browser.webContents.executeJavaScript(`
    (async () => {
      const response = await fetch(${JSON.stringify(url)});
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      const contentType = response.headers.get('content-type');
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 0x8000;
      for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
      }
      return {
        contentType,
        base64: btoa(binary),
      };
    })()
  `, true)

  if (!payload || typeof payload !== 'object') {
    throw new AppError('SPELLBOOK_IMAGE_FETCH_FAILED', `图片抓取结果无效：${url}`)
  }

  const result = payload as { contentType?: unknown; base64?: unknown }
  if (typeof result.base64 !== 'string') {
    throw new AppError('SPELLBOOK_IMAGE_FETCH_FAILED', `图片抓取结果无效：${url}`)
  }

  return {
    contentType: typeof result.contentType === 'string' ? result.contentType : null,
    data: Buffer.from(result.base64, 'base64'),
  }
}

function extensionFromContentType(contentType: string | null, sourceUrl: string): string {
  if (contentType?.includes('png')) return 'png'
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return 'jpg'
  if (contentType?.includes('gif')) return 'gif'
  if (contentType?.includes('webp')) return 'webp'
  const pathname = new URL(sourceUrl).pathname.toLowerCase()
  if (pathname.endsWith('.png')) return 'png'
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'jpg'
  if (pathname.endsWith('.gif')) return 'gif'
  return 'webp'
}

function shouldCrawlChildLink(parentUrl: string, link: SpellbookRelatedLink, category: SpellbookCategory): boolean {
  if (!link.isInternal) {
    return false
  }
  const url = normalizeUrl(link.url)
  if (url === normalizeUrl(parentUrl) || url === SPELLBOOK_ROOT_URL) {
    return false
  }
  if (category === 'tool_nav') {
    return false
  }
  const pathname = new URL(url).pathname
  return pathname.includes('/法典/') || pathname.includes('/工具/')
}

export class SpellbookService {
  private readonly repo: SpellbookRepository

  constructor(repo: SpellbookRepository = new SpellbookRepository()) {
    this.repo = repo
  }

  getStatus(): SpellbookLibraryStatus {
    return this.repo.getStatus(SPELLBOOK_ROOT_URL)
  }

  listEntries(params?: SpellbookListParams): SpellbookEntrySummary[] {
    return this.repo.listEntries(params, getLibraryRootPath())
  }

  getEntry(id: string): SpellbookEntryDetail | null {
    return this.repo.getEntry(id, getLibraryRootPath())
  }

  async syncLibrary(): Promise<SpellbookSyncResult> {
    ensureLibraryDirs()
    const browser = createCrawlerWindow()
    const visited = new Set<string>()

    try {
      await loadUrl(browser, SPELLBOOK_ROOT_URL)
      const directoryItems = await extractDirectoryItems(browser)
      const entries: StoredSpellbookEntry[] = []
      const images: StoredSpellbookImage[] = []

      for (const item of directoryItems) {
        const url = normalizeUrl(item.url)
        const category = inferCategory(item.title, item.summary, url)

        if (!item.isInternal) {
          entries.push({
            id: stableEntryId(url),
            parentEntryId: null,
            title: item.title,
            summary: item.summary,
            category,
            kind: 'external_link',
            sourceUrl: url,
            promptText: null,
            promptCandidates: [],
            bodyText: item.summary,
            sections: item.summary ? [{ heading: '概览', blocks: [item.summary] }] : [],
            relatedLinks: [],
            modelHints: inferModelHints(item.title, item.summary),
            tags: inferTags(item.title, item.summary),
            coverImageRelPath: null,
            imageCount: 0,
            childCount: 0,
            syncedAt: new Date().toISOString(),
          })
          continue
        }

        const result = await this.crawlEntry(browser, url, null, category, {
          seedTitle: item.title,
          seedSummary: item.summary,
        }, visited, 0)
        entries.push(...result.entries)
        images.push(...result.images)
      }

      this.repo.replaceLibrary(SPELLBOOK_ROOT_URL, entries, images)
      const status = this.getStatus()
      return {
        synced: true,
        totalEntries: status.totalEntries,
        totalImages: status.totalImages,
        lastSyncedAt: status.lastSyncedAt,
        rootUrl: status.rootUrl,
      }
    } finally {
      browser.destroy()
    }
  }

  private async crawlEntry(
    browser: BrowserWindow,
    sourceUrl: string,
    parentEntryId: string | null,
    category: SpellbookCategory,
    seed: { seedTitle: string; seedSummary: string },
    visited: Set<string>,
    depth: number,
  ): Promise<CrawlResult> {
    const normalizedUrl = normalizeUrl(sourceUrl)
    if (visited.has(normalizedUrl)) {
      return { entries: [], images: [] }
    }
    visited.add(normalizedUrl)

    await loadUrl(browser, normalizedUrl)
    const detail = await extractDetailContent(browser)
    const entryId = stableEntryId(normalizedUrl)

    const localImages: StoredSpellbookImage[] = []
    for (const [index, image] of detail.images.slice(0, MAX_IMAGES_PER_ENTRY).entries()) {
      if (!isInternalSpellbookUrl(image.url)) {
        continue
      }
      try {
        const binary = await fetchBinaryThroughPage(browser, image.url)
        const extension = extensionFromContentType(binary.contentType, image.url)
        const filename = `${entryId}-${index + 1}.${extension}`
        const relPath = `${SPELLBOOK_IMAGES_DIRNAME}/${filename}`
        fs.writeFileSync(path.join(getLibraryRootPath(), relPath), binary.data)
        localImages.push({
          id: `${entryId}_img_${index + 1}`,
          entryId,
          sourceUrl: image.url,
          localRelPath: relPath,
          caption: image.caption,
          sortOrder: index,
        })
      } catch {
        // Skip individual image failures; text content remains usable.
      }
    }

    const childLinks = depth < 1
      ? detail.links.filter((link) => shouldCrawlChildLink(normalizedUrl, link, category)).slice(0, MAX_CHILD_LINKS)
      : []

    const childResults: CrawlResult[] = []
    for (const childLink of childLinks) {
      childResults.push(await this.crawlEntry(
        browser,
        childLink.url,
        entryId,
        category,
        { seedTitle: childLink.title, seedSummary: '' },
        visited,
        depth + 1,
      ))
    }

    const childEntries = childResults.flatMap((result) => result.entries)
    const childImages = childResults.flatMap((result) => result.images)
    const promptText = detail.promptCandidates.length > 0 ? detail.promptCandidates.join('\n\n') : null

    const entry: StoredSpellbookEntry = {
      id: entryId,
      parentEntryId,
      title: detail.title || seed.seedTitle,
      summary: detail.summary || seed.seedSummary,
      category,
      kind: parentEntryId ? 'site_child_page' : 'site_page',
      sourceUrl: normalizedUrl,
      promptText,
      promptCandidates: detail.promptCandidates,
      bodyText: detail.bodyText,
      sections: detail.sections,
      relatedLinks: detail.links,
      modelHints: inferModelHints(detail.title, detail.summary, detail.bodyText),
      tags: inferTags(detail.title || seed.seedTitle, detail.summary || seed.seedSummary),
      coverImageRelPath: localImages[0]?.localRelPath ?? null,
      imageCount: detail.images.length,
      childCount: childEntries.filter((child) => child.parentEntryId === entryId).length,
      syncedAt: new Date().toISOString(),
    }

    return {
      entries: [entry, ...childEntries],
      images: [...localImages, ...childImages],
    }
  }
}
