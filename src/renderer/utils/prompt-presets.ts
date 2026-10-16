import type { EntryAnalysisResult } from '@shared/types/llm'
import type {
  PromptPresetItem,
  PromptPresetSection,
  PromptPresetSyntaxMode,
} from '@shared/types/preset'

export interface EditablePromptPresetItem extends PromptPresetItem {
  enabled: boolean
}

export interface EditablePromptPresetSection {
  id: string
  key: string
  label: string
  tone: 'positive' | 'negative'
  enabled: boolean
  items: EditablePromptPresetItem[]
}

function makeDraftSectionId(sectionKey: string, index: number): string {
  const normalizedKey = sectionKey.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 24)
  return `${normalizedKey || 'section'}-${index}`
}

function makeDraftItemId(sectionKey: string, index: number, text: string): string {
  const normalizedText = text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '').slice(0, 24)
  return `${sectionKey}-${index}-${normalizedText || 'item'}`
}

export function isNegativeCategory(key: string, label: string): boolean {
  return /(negative|neg|负向|反向)/i.test(`${key} ${label}`)
}

export function buildPresetDraftSectionsFromAnalysis(
  analysis: EntryAnalysisResult,
): EditablePromptPresetSection[] {
  const combined: Array<{
    key: string
    label: string
    items: EntryAnalysisResult['categories'][number]['items']
  }> = [
    ...analysis.categories,
    ...Object.entries(analysis.customCategories).map(([key, items]) => ({
      key,
      label: key,
      items,
    })),
  ]

  return combined.flatMap((section, sectionIndex) => {
    const items = section.items
      .filter((item) => item.text.trim())
      .map((item, index) => ({
        id: makeDraftItemId(section.key, index, item.text),
        text: item.text.trim(),
        weight: item.weight,
        note: item.note?.trim() ? item.note.trim() : null,
        enabled: item.enabled !== false,
      }))

    if (items.length === 0) {
      return []
    }

    return [{
      id: makeDraftSectionId(section.key, sectionIndex),
      key: section.key,
      label: section.label,
      tone: isNegativeCategory(section.key, section.label) ? 'negative' : 'positive',
      enabled: items.some((item) => item.enabled),
      items,
    }]
  })
}

export function collapseEditablePresetSections(
  sections: EditablePromptPresetSection[],
  tone: EditablePromptPresetSection['tone'],
): PromptPresetSection[] {
  return sections
    .filter((section) => section.tone === tone)
    .map((section) => ({
      key: section.key,
      label: section.label,
      items: section.items
        .filter((item) => item.enabled && item.text.trim())
        .map((item) => ({
          id: item.id,
          text: item.text.trim(),
          weight: item.weight != null && Number.isFinite(item.weight) ? item.weight : null,
          note: item.note?.trim() ? item.note.trim() : null,
        })),
    }))
    .filter((section) => section.items.length > 0)
}

function formatWeight(weight: number): string {
  return weight.toFixed(4).replace(/\.?0+$/, '')
}

function formatLoraTag(text: string, weight: number | null): string {
  const match = /^<lora:([^:>]+)(?::([-+]?[0-9]*\.?[0-9]+))?>$/i.exec(text.trim())
  if (!match) {
    return text
  }

  const loraName = match[1]
  const nextWeight = weight ?? (match[2] ? Number(match[2]) : 1)
  return `<lora:${loraName}:${formatWeight(nextWeight)}>`
}

function wrapNaiWeight(text: string, weight: number): string {
  if (weight >= 1.01) {
    const repeats = Math.max(1, Math.min(8, Math.round(Math.log(weight) / Math.log(1.05))))
    return `${'{'.repeat(repeats)}${text}${'}'.repeat(repeats)}`
  }

  if (weight <= 0.99) {
    const repeats = Math.max(1, Math.min(8, Math.round(Math.log(1 / weight) / Math.log(1.05))))
    return `${'['.repeat(repeats)}${text}${']'.repeat(repeats)}`
  }

  return text
}

export function formatPresetItemText(
  text: string,
  weight: number | null,
  syntaxMode: PromptPresetSyntaxMode,
): string {
  const normalizedText = text.trim()
  if (!normalizedText) {
    return ''
  }

  if (/^<lora:/i.test(normalizedText)) {
    return formatLoraTag(normalizedText, weight)
  }

  if (weight == null || Math.abs(weight - 1) < 0.0001) {
    return normalizedText
  }

  if (syntaxMode === 'nai') {
    return wrapNaiWeight(normalizedText, weight)
  }

  return `(${normalizedText}:${formatWeight(weight)})`
}

export function formatPromptPresetText(
  sections: PromptPresetSection[],
  syntaxMode: PromptPresetSyntaxMode,
): string {
  return sections
    .flatMap((section) => section.items)
    .map((item) => formatPresetItemText(item.text, item.weight, syntaxMode))
    .filter(Boolean)
    .join(', ')
}

export function countEnabledPresetItems(sections: EditablePromptPresetSection[]): number {
  return sections.reduce(
    (total, section) => total + section.items.filter((item) => item.enabled && item.text.trim()).length,
    0,
  )
}
