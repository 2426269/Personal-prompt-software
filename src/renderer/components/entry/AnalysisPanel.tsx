import type { AnalysisCategory, AnalysisTagItem, EntryAnalysisResult } from '@shared/types/llm'
import { useState } from 'react'
import styles from './AnalysisPanel.module.css'

interface AnalysisPanelProps {
  analysis: EntryAnalysisResult | null
  isAnalyzing: boolean
  onAnalyze: () => void
}

export function AnalysisPanel({ analysis, isAnalyzing, onAnalyze }: AnalysisPanelProps) {
  if (!analysis) {
    return (
      <div className={styles.emptyAnalysis}>
        <div className={styles.emptyIcon}>🔍</div>
        <p>该条目还未被 LLM 分析。</p>
        <button className={styles.analyzeBtn} onClick={onAnalyze} disabled={isAnalyzing}>
          {isAnalyzing ? '⏳ 分析中...' : '🧠 开始 LLM 分析'}
        </button>
      </div>
    )
  }

  return (
    <div className={styles.analysisPanel}>
      {/* Meta info */}
      <div className={styles.analysisMeta}>
        <span className={styles.metaBadge}>{analysis.nsfwMode === 'sanitize' ? '🔒 脱敏' : '🔓 完整'}</span>
        {analysis.aiModelUsed && <span className={styles.metaBadge}>🤖 {analysis.aiModelUsed}</span>}
        <span className={styles.metaBadge}>📅 {new Date(analysis.createdAt).toLocaleString('zh-CN')}</span>
        <button className={styles.analyzeBtn} onClick={onAnalyze} disabled={isAnalyzing} style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: '12px' }}>
          {isAnalyzing ? '⏳...' : '🔄 重新分析'}
        </button>
      </div>

      {/* Common settings */}
      {analysis.settingsCommon && (
        <SettingsGrid settings={analysis.settingsCommon} />
      )}

      {/* Categories */}
      {analysis.categories.map((cat) => (
        <CategoryBlock key={cat.key} category={cat} />
      ))} 

      {/* Custom categories */}
      {Object.entries(analysis.customCategories).map(([key, items]) => (
        <CategoryBlock key={`custom-${key}`} category={{ key, label: key, items }} />
      ))}

      {/* Removed specific items */}
      {analysis.removedSpecific.length > 0 && (
        <div className={styles.removedSection}>
          <div className={styles.removedTitle}>🗑️ 已移除的特定项 ({analysis.removedSpecific.length})</div>
          {analysis.removedSpecific.map((item, i) => (
            <span key={i} className={styles.removedPill}>{item}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function SettingsGrid({ settings }: { settings: EntryAnalysisResult['settingsCommon'] }) {
  const items: { label: string; value: string | number | null }[] = [
    { label: '模型', value: settings.model },
    { label: '采样器', value: settings.sampler },
    { label: 'Steps', value: settings.steps },
    { label: 'CFG', value: settings.cfg },
    { label: 'Seed', value: settings.seed },
    { label: '尺寸', value: settings.width && settings.height ? `${settings.width}×${settings.height}` : null },
  ]

  const validItems = items.filter(i => i.value != null)
  if (validItems.length === 0 && settings.loras.length === 0) return null

  return (
    <div className={styles.settingsGrid}>
      {validItems.map((item) => (
        <div key={item.label} className={styles.settingItem}>
          <div className={styles.settingLabel}>{item.label}</div>
          <div className={styles.settingValue}>{item.value}</div>
        </div>
      ))}
      {settings.loras.length > 0 && (
        <div className={styles.settingItem} style={{ gridColumn: '1 / -1' }}>
          <div className={styles.settingLabel}>LoRA ({settings.loras.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
            {settings.loras.map((lora) => (
              <span key={lora.text} className={styles.analysisPill}>
                {lora.text}
                {lora.weight != null && lora.weight !== 1 && <span className={styles.pillWeight}>:{lora.weight}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CategoryBlock({ category }: { category: AnalysisCategory }) {
  const [open, setOpen] = useState(true)

  return (
    <div className={styles.categoryBlock}>
      <div className={styles.categoryHeader} onClick={() => setOpen(!open)}>
        <span className={styles.categoryName}>{open ? '▾' : '▸'} {category.label}</span>
        <span className={styles.categoryCount}>{category.items.length}</span>
      </div>
      {open && (
        <div className={styles.categoryItems}>
          {category.items.map((item, i) => (
            <AnalysisPillItem key={i} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function AnalysisPillItem({ item }: { item: AnalysisTagItem }) {
  const classNames = [
    styles.analysisPill,
    !item.enabled ? styles.disabled : '',
    item.source === 'manual' ? styles.manual : '',
  ].filter(Boolean).join(' ')

  return (
    <span className={classNames} title={item.note ?? undefined}>
      {item.text}
      {item.weight != null && <span className={styles.pillWeight}>:{item.weight}</span>}
      {item.confidence != null && <span className={styles.pillConfidence}>({Math.round(item.confidence * 100)}%)</span>}
    </span>
  )
}
