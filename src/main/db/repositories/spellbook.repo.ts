import type { Database } from 'better-sqlite3'

import type {
  SpellbookEntryDetail,
  SpellbookEntrySummary,
  SpellbookImageRef,
  SpellbookLibraryStatus,
  SpellbookListParams,
  SpellbookRelatedLink,
  SpellbookSection,
} from '@shared/types/spellbook'

import { getDatabase } from '../database'

interface SpellbookMetaRow {
  root_url: string
  total_entries: number
  total_images: number
  last_synced_at: string | null
}

interface SpellbookEntryRow {
  id: string
  parent_entry_id: string | null
  title: string
  summary: string
  category: 'style_prompt' | 'tool_nav' | 'tag_reference'
  kind: 'site_page' | 'site_child_page' | 'external_link'
  source_url: string
  prompt_text: string | null
  prompt_candidates_json: string
  body_text: string
  sections_json: string
  related_links_json: string
  model_hints_json: string
  tags_json: string
  cover_image_rel_path: string | null
  image_count: number
  child_count: number
  synced_at: string | null
  updated_at: string | null
}

interface SpellbookImageRow {
  source_url: string
  local_rel_path: string
  caption: string | null
}

interface CountRow {
  count: number
}

export interface StoredSpellbookImage {
  id: string
  entryId: string
  sourceUrl: string
  localRelPath: string
  caption: string | null
  sortOrder: number
}

export interface StoredSpellbookEntry {
  id: string
  parentEntryId: string | null
  title: string
  summary: string
  category: 'style_prompt' | 'tool_nav' | 'tag_reference'
  kind: 'site_page' | 'site_child_page' | 'external_link'
  sourceUrl: string
  promptText: string | null
  promptCandidates: string[]
  bodyText: string
  sections: SpellbookSection[]
  relatedLinks: SpellbookRelatedLink[]
  modelHints: string[]
  tags: string[]
  coverImageRelPath: string | null
  imageCount: number
  childCount: number
  syncedAt: string
}

function parseJsonArray<T>(value: string | null | undefined, fallback: T[]): T[] {
  if (!value) {
    return fallback
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : fallback
  } catch {
    return fallback
  }
}

function buildImageRef(libraryRootPath: string | null, relPath: string | null, sourceUrl = '', caption: string | null = null): SpellbookImageRef | null {
  if (!relPath && !sourceUrl) {
    return null
  }

  return {
    localPath: relPath && libraryRootPath ? `${libraryRootPath}\\${relPath.replace(/\//g, '\\')}` : null,
    originalUrl: sourceUrl,
    caption,
  }
}

function mapSummary(row: SpellbookEntryRow, libraryRootPath: string | null): SpellbookEntrySummary {
  return {
    id: row.id,
    parentEntryId: row.parent_entry_id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    kind: row.kind,
    sourceUrl: row.source_url,
    promptTextPreview: row.prompt_text ? row.prompt_text.slice(0, 240) : null,
    modelHints: parseJsonArray<string>(row.model_hints_json, []),
    tags: parseJsonArray<string>(row.tags_json, []),
    coverImage: buildImageRef(libraryRootPath, row.cover_image_rel_path, ''),
    imageCount: row.image_count,
    childCount: row.child_count,
    updatedAt: row.updated_at,
  }
}

export class SpellbookRepository {
  private readonly db: Database

  constructor(db: Database = getDatabase()) {
    this.db = db
  }

  getMeta(): SpellbookMetaRow | null {
    return this.db.prepare<[], SpellbookMetaRow>(`
      SELECT root_url, total_entries, total_images, last_synced_at
      FROM spellbook_meta
      WHERE id = 1
      LIMIT 1
    `).get() ?? null
  }

  replaceLibrary(rootUrl: string, entries: StoredSpellbookEntry[], images: StoredSpellbookImage[]): void {
    const deleteImages = this.db.prepare('DELETE FROM spellbook_images')
    const deleteEntries = this.db.prepare('DELETE FROM spellbook_entries')
    const saveMeta = this.db.prepare(`
      INSERT INTO spellbook_meta (id, root_url, total_entries, total_images, last_synced_at, updated_at)
      VALUES (1, @root_url, @total_entries, @total_images, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        root_url=excluded.root_url,
        total_entries=excluded.total_entries,
        total_images=excluded.total_images,
        last_synced_at=CURRENT_TIMESTAMP,
        updated_at=CURRENT_TIMESTAMP
    `)
    const insertEntry = this.db.prepare(`
      INSERT INTO spellbook_entries (
        id,
        parent_entry_id,
        title,
        summary,
        category,
        kind,
        source_url,
        prompt_text,
        prompt_candidates_json,
        body_text,
        sections_json,
        related_links_json,
        model_hints_json,
        tags_json,
        cover_image_rel_path,
        image_count,
        child_count,
        synced_at,
        created_at,
        updated_at
      ) VALUES (
        @id,
        @parent_entry_id,
        @title,
        @summary,
        @category,
        @kind,
        @source_url,
        @prompt_text,
        @prompt_candidates_json,
        @body_text,
        @sections_json,
        @related_links_json,
        @model_hints_json,
        @tags_json,
        @cover_image_rel_path,
        @image_count,
        @child_count,
        @synced_at,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `)
    const insertImage = this.db.prepare(`
      INSERT INTO spellbook_images (
        id,
        entry_id,
        source_url,
        local_rel_path,
        caption,
        sort_order,
        created_at
      ) VALUES (
        @id,
        @entry_id,
        @source_url,
        @local_rel_path,
        @caption,
        @sort_order,
        CURRENT_TIMESTAMP
      )
    `)

    this.db.transaction(() => {
      deleteImages.run()
      deleteEntries.run()

      for (const entry of entries) {
        insertEntry.run({
          id: entry.id,
          parent_entry_id: entry.parentEntryId,
          title: entry.title,
          summary: entry.summary,
          category: entry.category,
          kind: entry.kind,
          source_url: entry.sourceUrl,
          prompt_text: entry.promptText,
          prompt_candidates_json: JSON.stringify(entry.promptCandidates),
          body_text: entry.bodyText,
          sections_json: JSON.stringify(entry.sections),
          related_links_json: JSON.stringify(entry.relatedLinks),
          model_hints_json: JSON.stringify(entry.modelHints),
          tags_json: JSON.stringify(entry.tags),
          cover_image_rel_path: entry.coverImageRelPath,
          image_count: entry.imageCount,
          child_count: entry.childCount,
          synced_at: entry.syncedAt,
        })
      }

      for (const image of images) {
        insertImage.run({
          id: image.id,
          entry_id: image.entryId,
          source_url: image.sourceUrl,
          local_rel_path: image.localRelPath,
          caption: image.caption,
          sort_order: image.sortOrder,
        })
      }

      saveMeta.run({
        root_url: rootUrl,
        total_entries: entries.length,
        total_images: images.length,
      })
    })()
  }

  listEntries(params: SpellbookListParams | undefined, libraryRootPath: string | null): SpellbookEntrySummary[] {
    const whereClauses: string[] = []
    const values: Record<string, unknown> = {}

    if (params?.category) {
      whereClauses.push('category = @category')
      values.category = params.category
    }

    if (!params?.includeChildren) {
      whereClauses.push('parent_entry_id IS NULL')
    }

    if (params?.searchQuery?.trim()) {
      values.search = `%${params.searchQuery.trim().toLowerCase()}%`
      whereClauses.push('(LOWER(title) LIKE @search OR LOWER(summary) LIKE @search OR LOWER(body_text) LIKE @search OR LOWER(prompt_text) LIKE @search)')
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
    const orderColumn = params?.sortBy === 'updated_at' ? 'updated_at' : 'title COLLATE NOCASE'
    const orderDirection = params?.sortOrder === 'desc' ? 'DESC' : 'ASC'

    const rows = this.db.prepare<Record<string, unknown>, SpellbookEntryRow>(`
      SELECT *
      FROM spellbook_entries
      ${whereSql}
      ORDER BY ${orderColumn} ${orderDirection}, title COLLATE NOCASE ASC
    `).all(values)

    return rows.map((row) => mapSummary(row, libraryRootPath))
  }

  getEntry(id: string, libraryRootPath: string | null): SpellbookEntryDetail | null {
    const row = this.db.prepare<[string], SpellbookEntryRow>(`
      SELECT *
      FROM spellbook_entries
      WHERE id = ?
      LIMIT 1
    `).get(id)

    if (!row) {
      return null
    }

    const images = this.db.prepare<[string], SpellbookImageRow>(`
      SELECT source_url, local_rel_path, caption
      FROM spellbook_images
      WHERE entry_id = ?
      ORDER BY sort_order ASC, created_at ASC
    `).all(id)

    const children = this.db.prepare<[string], SpellbookEntryRow>(`
      SELECT *
      FROM spellbook_entries
      WHERE parent_entry_id = ?
      ORDER BY title COLLATE NOCASE ASC
    `).all(id)

    const summary = mapSummary(row, libraryRootPath)

    return {
      ...summary,
      bodyText: row.body_text,
      promptText: row.prompt_text,
      promptCandidates: parseJsonArray<string>(row.prompt_candidates_json, []),
      sections: parseJsonArray<SpellbookSection>(row.sections_json, []),
      relatedLinks: parseJsonArray<SpellbookRelatedLink>(row.related_links_json, []),
      images: images.map((image) => buildImageRef(libraryRootPath, image.local_rel_path, image.source_url, image.caption)).filter(Boolean) as SpellbookImageRef[],
      childEntries: children.map((child) => mapSummary(child, libraryRootPath)),
    }
  }

  getStatus(rootUrlFallback: string): SpellbookLibraryStatus {
    const meta = this.getMeta()
    const countByCategory = this.db.prepare<[string], CountRow>(`
      SELECT COUNT(*) AS count
      FROM spellbook_entries
      WHERE category = ? AND parent_entry_id IS NULL
    `)

    return {
      synced: Boolean(meta?.last_synced_at),
      rootUrl: meta?.root_url ?? rootUrlFallback,
      totalEntries: meta?.total_entries ?? 0,
      totalImages: meta?.total_images ?? 0,
      lastSyncedAt: meta?.last_synced_at ?? null,
      entryCounts: {
        stylePrompt: countByCategory.get('style_prompt')?.count ?? 0,
        toolNav: countByCategory.get('tool_nav')?.count ?? 0,
        tagReference: countByCategory.get('tag_reference')?.count ?? 0,
      },
    }
  }
}
