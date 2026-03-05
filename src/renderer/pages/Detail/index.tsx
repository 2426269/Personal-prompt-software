import { useNavigate, useParams } from 'react-router-dom'
import { RawPayload } from '../../components/entry/RawPayload'
import { SourceCard } from '../../components/entry/SourceCard'
import styles from './Detail.module.css'

export function Detail() {
  const { id } = useParams()
  const navigate = useNavigate()

  // Placeholder data to show structure
  const mockPayload = { "generator": "NovelAI", "prompt": "1girl, solo", "seed": 12345 }

  return (
    <div className={styles.detailPage}>
      {/* Left Column: Context & Base Data */}
      <aside className={styles.leftColumn}>
        <button onClick={() => void navigate(-1)} style={{ color: 'var(--accent-blue)', textAlign: 'left', marginBottom: 'var(--space-2)' }}>
          ← 返回图库
        </button>
        
        <SourceCard type="NAI" modelName="NAI Diffusion Anime V3" />
        
        <div>
          <h3 className={styles.sectionTitle}>正向提示词 (Prompt)</h3>
          <div className={`${styles.card} font-mono`} style={{ minHeight: '120px' }}>
            masterpiece, best quality, 1girl, solo, reading a book
          </div>
        </div>
        
        <div>
          <h3 className={styles.sectionTitle}>反向提示词 (Negative Prompt)</h3>
          <div className={`${styles.card} font-mono`} style={{ minHeight: '80px' }}>
            lowres, bad anatomy, bad hands, text, error
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.btnPrimary}>一键复制提示词</button>
        </div>
      </aside>

      {/* Center Main: WorkSpace / Canvas / Template Editor */}
      <main className={styles.workspace}>
        <h2 style={{ marginTop: 0 }}>作品分析面板 {id ? `#${id}` : ''}</h2>
        <div className={styles.card} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', backgroundColor: 'transparent' }}>
          <p style={{ color: 'var(--text-secondary)' }}>主视图区：展示关联图片画廊，提供“翻译提示词工作流”触发区域</p>
        </div>
      </main>

      {/* Right Column: Reference & Metadata */}
      <aside className={styles.rightColumn}>
        <div>
          <h3 className={styles.sectionTitle}>元数据参数 (Parameters)</h3>
          <div className={styles.card}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', fontSize: '13px' }}>
              <div><strong>Sampler:</strong> Euler a</div>
              <div><strong>Steps:</strong> 28</div>
              <div><strong>CFG Scale:</strong> 5.0</div>
              <div><strong>Seed:</strong> 123456789</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h3 className={styles.sectionTitle}>原始负载 (Raw JSON Payload)</h3>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <RawPayload data={mockPayload} title="NAI Payload Details" />
          </div>
        </div>
      </aside>
    </div>
  )
}
