import type { PromptTemplate, PromptTemplateCategory, PromptTemplateInput, PromptTemplateItem } from '@shared/types/template'
import React, { useCallback, useEffect, useState } from 'react'
import styles from './TemplateEditor.module.css'

export function TemplateEditor() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<PromptTemplateInput | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const loadTemplates = useCallback(async () => {
    try {
      const res = await window.api.listTemplates()
      if (res.success && res.data) {
        setTemplates(res.data)
        if (!selectedId && res.data.length > 0) {
          selectTemplate(res.data[0])
        }
      }
    } catch (err) {
      console.error('Failed to load templates:', err)
    }
  }, [selectedId])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  const selectTemplate = (tpl: PromptTemplate) => {
    setSelectedId(tpl.id)
    setDraft({
      id: tpl.id,
      name: tpl.name,
      description: tpl.description,
      systemPrompt: tpl.systemPrompt,
      templateJson: tpl.templateJson,
      mode: tpl.mode,
      isDefault: tpl.isDefault,
    })
  }

  const createNew = () => {
    setSelectedId(null)
    setDraft({
      name: '新模板',
      systemPrompt: '',
      templateJson: [],
      mode: 'sanitize',
    })
  }

  const handleSave = async () => {
    if (!draft) return
    try {
      setIsSaving(true)
      const res = await window.api.saveTemplate(draft)
      if (res.success && res.data) {
        setSelectedId(res.data.id)
        void loadTemplates()
      }
    } catch (err) {
      console.error('Failed to save template:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedId) return
    if (!window.confirm('确定要删除此模板吗？')) return
    try {
      await window.api.deleteTemplate(selectedId)
      setSelectedId(null)
      setDraft(null)
      void loadTemplates()
    } catch (err) {
      console.error('Failed to delete template:', err)
    }
  }

  const updateDraft = (updates: Partial<PromptTemplateInput>) => {
    setDraft((prev) => prev ? { ...prev, ...updates } : prev)
  }

  const addCategory = () => {
    if (!draft) return
    const newCat: PromptTemplateCategory = {
      id: crypto.randomUUID(),
      name: '新分类',
      enabled: true,
      note: null,
      items: [],
    }
    updateDraft({ templateJson: [...(draft.templateJson ?? []), newCat] })
  }

  const updateCategory = (catId: string, updates: Partial<PromptTemplateCategory>) => {
    if (!draft?.templateJson) return
    updateDraft({
      templateJson: draft.templateJson.map((c) =>
        c.id === catId ? { ...c, ...updates } : c
      ),
    })
  }

  const removeCategory = (catId: string) => {
    if (!draft?.templateJson) return
    updateDraft({ templateJson: draft.templateJson.filter((c) => c.id !== catId) })
  }

  const addItem = (catId: string) => {
    if (!draft?.templateJson) return
    const newItem: PromptTemplateItem = {
      id: crypto.randomUUID(),
      text: '',
      weight: null,
      enabled: true,
      note: null,
      source: 'manual',
      confidence: null,
    }
    updateDraft({
      templateJson: draft.templateJson.map((c) =>
        c.id === catId ? { ...c, items: [...c.items, newItem] } : c
      ),
    })
  }

  const updateItem = (catId: string, itemId: string, updates: Partial<PromptTemplateItem>) => {
    if (!draft?.templateJson) return
    updateDraft({
      templateJson: draft.templateJson.map((c) =>
        c.id === catId
          ? { ...c, items: c.items.map((it) => (it.id === itemId ? { ...it, ...updates } : it)) }
          : c
      ),
    })
  }

  const removeItem = (catId: string, itemId: string) => {
    if (!draft?.templateJson) return
    updateDraft({
      templateJson: draft.templateJson.map((c) =>
        c.id === catId ? { ...c, items: c.items.filter((it) => it.id !== itemId) } : c
      ),
    })
  }

  return (
    <div className={styles.templateEditor}>
      {/* Template tabs */}
      <div className={styles.templateList}>
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            className={`${styles.templateTab} ${tpl.id === selectedId ? styles.active : ''} ${tpl.isDefault ? styles.isDefault : ''}`}
            onClick={() => selectTemplate(tpl)}
          >
            {tpl.name}
          </button>
        ))}
        <button className={styles.newTemplateBtn} onClick={createNew}>+ 新建</button>
      </div>

      {/* Editor */}
      {draft && (
        <>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>模板名称</label>
            <input
              className={styles.formInput}
              value={draft.name}
              onChange={(e) => updateDraft({ name: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>描述</label>
            <input
              className={styles.formInput}
              value={draft.description ?? ''}
              onChange={(e) => updateDraft({ description: e.target.value || null })}
              placeholder="可选描述..."
            />
          </div>

          <div className={styles.formGroup}>
            <div className={styles.formRow}>
              <label className={styles.formLabel} style={{ marginBottom: 0 }}>分析模式</label>
              <div className={styles.modeToggle}>
                <button
                  className={`${styles.modeOption} ${draft.mode === 'sanitize' ? styles.active : ''}`}
                  onClick={() => updateDraft({ mode: 'sanitize' })}
                >
                  🔒 脱敏
                </button>
                <button
                  className={`${styles.modeOption} ${draft.mode === 'full' ? styles.active : ''}`}
                  onClick={() => updateDraft({ mode: 'full' })}
                >
                  🔓 完整
                </button>
              </div>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>System Prompt</label>
            <textarea
              className={styles.formTextarea}
              value={draft.systemPrompt}
              onChange={(e) => updateDraft({ systemPrompt: e.target.value })}
              placeholder="输入系统提示词..."
            />
          </div>

          <div className={styles.formGroup}>
            <div className={styles.formRow}>
              <label className={styles.formLabel} style={{ marginBottom: 0 }}>
                分类条目 ({draft.templateJson?.length ?? 0} 个分类)
              </label>
              <button className={styles.smallBtn} onClick={addCategory}>+ 添加分类</button>
            </div>
          </div>

          {draft.templateJson?.map((cat) => (
            <div key={cat.id} className={styles.categoryBlock}>
              <div className={styles.categoryHeader}>
                <input
                  type="checkbox"
                  className={styles.itemCheckbox}
                  checked={cat.enabled}
                  onChange={(e) => updateCategory(cat.id, { enabled: e.target.checked })}
                />
                <input
                  className={styles.categoryNameInput}
                  value={cat.name}
                  onChange={(e) => updateCategory(cat.id, { name: e.target.value })}
                />
                <div className={styles.categoryActions}>
                  <button className={styles.smallBtn} onClick={() => addItem(cat.id)}>+ 条目</button>
                  <button className={`${styles.smallBtn} ${styles.danger}`} onClick={() => removeCategory(cat.id)}>✕</button>
                </div>
              </div>
              {cat.items.map((item) => (
                <div key={item.id} className={styles.itemRow}>
                  <input
                    type="checkbox"
                    className={styles.itemCheckbox}
                    checked={item.enabled}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(cat.id, item.id, { enabled: e.target.checked })}
                  />
                  <input
                    className={styles.itemText}
                    value={item.text}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(cat.id, item.id, { text: e.target.value })}
                    placeholder="输入条目文本..."
                  />
                  <input
                    className={styles.itemWeight}
                    type="number"
                    step="0.1"
                    value={item.weight ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(cat.id, item.id, { weight: e.target.value ? Number(e.target.value) : null })}
                    placeholder="权重"
                  />
                  <button className={`${styles.smallBtn} ${styles.danger}`} onClick={() => removeItem(cat.id, item.id)}>✕</button>
                </div>
              ))}
            </div>
          ))}

          <div className={styles.actionBar}>
            <button className={styles.saveBtn} onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? '保存中...' : '💾 保存模板'}
            </button>
            {selectedId && (
              <button className={styles.deleteBtn} onClick={() => void handleDelete()}>
                🗑️ 删除模板
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
