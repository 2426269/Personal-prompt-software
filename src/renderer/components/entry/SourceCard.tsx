import type { PromptSourceType } from '@shared/types/importer'
import styles from './SourceCard.module.css'

interface SourceCardProps {
  type: PromptSourceType
  modelName?: string | null
}

const TYPE_CONFIG = {
  NAI: { label: 'NovelAI', className: styles.nai },
  SD: { label: 'Stable Diffusion', className: styles.sd },
  ComfyUI: { label: 'ComfyUI Workflow', className: styles.comfyui },
  Unknown: { label: 'Unknown Source', className: styles.unknown },
}

export function SourceCard({ type, modelName }: SourceCardProps) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.Unknown

  return (
    <div className={styles.sourceCard}>
      <div className={`${styles.indicator} ${config.className}`} />
      <span className={styles.label}>{config.label}</span>
      {modelName && <span className={styles.subLabel}>({modelName})</span>}
    </div>
  )
}
