import type { EntryAnalysisResult } from '@shared/types/llm'
import type { EntryDetail, EntryImageDetail } from '@shared/types/entry'
import type { PromptPresetDetail, PromptPresetSyntaxMode } from '@shared/types/preset'
import { useEffect, useMemo, useState } from 'react'

import {
  buildPresetDraftSectionsFromAnalysis,
  collapseEditablePresetSections,
  countEnabledPresetItems,
  type EditablePromptPresetSection,
} from '@renderer/utils/prompt-presets'

import styles from './ExportPresetModal.module.css'

interface ExportPresetModalProps {
  isOpen: boolean
  entry: EntryDetail
  image: EntryImageDetail
  analysis: EntryAnalysisResult
  onClose: () => void
  onSaved: (preset: PromptPresetDetail) => void
}

function buildInitialName(entry: EntryDetail, image: EntryImageDetail): string {
  return `${entry.displayTitle} · 图 ${image.index + 1}`
}

export function ExportPresetModal({
  isOpen,
  entry,
  image,
  analysis,
  onClose,
  onSaved,
}: ExportPresetModalProps) {
  const [name, setName] = useState('')
  const [syntaxMode, setSyntaxMode] = useState<PromptPresetSyntaxMode>('sd')
  const [sections, setSections] = useState<EditablePromptPresetSection[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setName(buildInitialName(entry, image))
    setSyntaxMode(entry.type === 'NAI' ? 'nai' : 'sd')
    setSections(buildPresetDraftSectionsFromAnalysis(analysis))
    setError('')
    setIsSaving(false)
  }, [analysis, entry, image, isOpen])

  const positiveSections = useMemo(
    () => sections.filter((section) => section.tone === 'positive'),
    [sections],
  )
  const negativeSections = useMemo(
    () => sections.filter((section) => section.tone === 'negative'),
    [sections],
  )
  const enabledPositiveCount = useMemo(
    () => countEnabledPresetItems(positiveSections),
    [positiveSections],
  )
  const enabledNegativeCount = useMemo(
    () => countEnabledPresetItems(negativeSections),
    [negativeSections],
  )

  if (!isOpen) {
    return null
  }

  const updateSection = (
    sectionId: string,
    updater: (section: EditablePromptPresetSection) => EditablePromptPresetSection,
  ) => {
    setSections((prev) => prev.map((section) => (section.id === sectionId ? updater(section) : section)))
  }

  const toggleAll = (enabled: boolean) => {
    setSections((prev) =>
      prev.map((section) => ({
        ...section,
        enabled,
        items: section.items.map((item) => ({ ...item, enabled })),
      })),
    )
  }

  const handleSave = async () => {
    setError('')
    setIsSaving(true)

    try {
      const res = await window.api.savePromptPreset({
        name,
        sourceEntryId: entry.id,
        sourceAnalysisId: analysis.id,
        sourceImageIndex: image.index,
        sourceEntryTitle: entry.displayTitle,
        sourcePromptType: entry.type,
        referenceImage: {
          originalUrl: image.originalUrl || null,
          localPath: image.localPath ?? null,
        },
        defaultSyntaxMode: syntaxMode,
        positiveSections: collapseEditablePresetSections(sections, 'positive'),
        negativeSections: collapseEditablePresetSections(sections, 'negative'),
      })

      if (!res.success || !res.data) {
        setError(res.error?.message ?? '保存失败。')
        return
      }

      onSaved(res.data)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>导出为提示词预设</h2>
            <div className={styles.subtitle}>
              当前来源：{entry.displayTitle} · 图 {image.index + 1}
            </div>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </header>

        <section className={styles.toolbar}>
          <label className={styles.field}>
            <span className={styles.label}>预设名称</span>
            <input
              className={styles.input}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="输入预设名称"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>权重语法</span>
            <select
              className={styles.select}
              value={syntaxMode}
              onChange={(event) => setSyntaxMode(event.target.value as PromptPresetSyntaxMode)}
            >
              <option value="sd">ComfyUI / SD</option>
              <option value="nai">NAI</option>
            </select>
          </label>

          <div className={styles.summaryCard}>
            <div>正向 {enabledPositiveCount}</div>
            <div>负向 {enabledNegativeCount}</div>
          </div>
        </section>

        <div className={styles.bulkActions}>
          <button className={styles.secondaryButton} onClick={() => toggleAll(true)}>
            全选
          </button>
          <button className={styles.secondaryButton} onClick={() => toggleAll(false)}>
            全部排除
          </button>
        </div>

        <div className={styles.columns}>
          <PresetColumn
            title="正向提示词"
            sections={positiveSections}
            onSectionChange={updateSection}
          />
          <PresetColumn
            title="负向提示词"
            sections={negativeSections}
            onSectionChange={updateSection}
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <footer className={styles.footer}>
          <button className={styles.secondaryButton} onClick={onClose} disabled={isSaving}>
            取消
          </button>
          <button className={styles.primaryButton} onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存预设'}
          </button>
        </footer>
      </div>
    </div>
  )
}

interface PresetColumnProps {
  title: string
  sections: EditablePromptPresetSection[]
  onSectionChange: (
    sectionId: string,
    updater: (section: EditablePromptPresetSection) => EditablePromptPresetSection,
  ) => void
}

function PresetColumn({ title, sections, onSectionChange }: PresetColumnProps) {
  return (
    <section className={styles.column}>
      <div className={styles.columnHeader}>
        <h3 className={styles.columnTitle}>{title}</h3>
      </div>

      {sections.length === 0 ? (
        <div className={styles.emptyColumn}>当前分析结果没有该方向的分类。</div>
      ) : (
        <div className={styles.sectionList}>
          {sections.map((section) => (
            <div key={section.id} className={styles.sectionCard}>
              <label className={styles.sectionTitleRow}>
                <input
                  type="checkbox"
                  checked={section.items.some((item) => item.enabled)}
                  onChange={(event) => {
                    const checked = event.target.checked
                    onSectionChange(section.id, (currentSection) => ({
                      ...currentSection,
                      enabled: checked,
                      items: currentSection.items.map((item) => ({ ...item, enabled: checked })),
                    }))
                  }}
                />
                <span>{section.label}</span>
                <span className={styles.sectionCount}>{section.items.filter((item) => item.enabled).length}</span>
              </label>

              <div className={styles.itemList}>
                {section.items.map((item) => (
                  <div key={item.id} className={styles.itemRow}>
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(event) => {
                        const checked = event.target.checked
                        onSectionChange(section.id, (currentSection) => ({
                          ...currentSection,
                          enabled: checked || currentSection.items.some((currentItem) => currentItem.id !== item.id && currentItem.enabled),
                          items: currentSection.items.map((currentItem) => (
                            currentItem.id === item.id ? { ...currentItem, enabled: checked } : currentItem
                          )),
                        }))
                      }}
                    />
                    <input
                      className={styles.itemInput}
                      value={item.text}
                      onChange={(event) => {
                        const nextValue = event.target.value
                        onSectionChange(section.id, (currentSection) => ({
                          ...currentSection,
                          items: currentSection.items.map((currentItem) => (
                            currentItem.id === item.id ? { ...currentItem, text: nextValue } : currentItem
                          )),
                        }))
                      }}
                    />
                    <input
                      className={styles.weightInput}
                      type="number"
                      step="0.05"
                      value={item.weight ?? ''}
                      onChange={(event) => {
                        const rawValue = event.target.value
                        onSectionChange(section.id, (currentSection) => ({
                          ...currentSection,
                          items: currentSection.items.map((currentItem) => (
                            currentItem.id === item.id
                              ? {
                                  ...currentItem,
                                  weight: rawValue === '' ? null : Number(rawValue),
                                }
                              : currentItem
                          )),
                        }))
                      }}
                    />
                    <button
                      className={styles.deleteButton}
                      onClick={() => {
                        onSectionChange(section.id, (currentSection) => {
                          const nextItems = currentSection.items.filter((currentItem) => currentItem.id !== item.id)
                          return {
                            ...currentSection,
                            enabled: nextItems.some((currentItem) => currentItem.enabled),
                            items: nextItems,
                          }
                        })
                      }}
                    >
                      ×
                    </button>
                    <input
                      className={styles.noteInput}
                      value={item.note ?? ''}
                      placeholder="中文 note / 备注"
                      onChange={(event) => {
                        const nextValue = event.target.value
                        onSectionChange(section.id, (currentSection) => ({
                          ...currentSection,
                          items: currentSection.items.map((currentItem) => (
                            currentItem.id === item.id
                              ? { ...currentItem, note: nextValue || null }
                              : currentItem
                          )),
                        }))
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
