import styles from './RawPayload.module.css'

interface RawPayloadProps {
  data: Record<string, unknown> | string
  title?: string
}

export function RawPayload({ data, title = 'RAW PAYLOAD' }: RawPayloadProps) {
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2)

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString)
      // TODO: Add standard toast notification later
      .then(() => console.log('Copied to clipboard'))
      .catch((err) => console.error('Failed to copy', err))
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <button className={styles.copyBtn} onClick={handleCopy} title="Copy to clipboard">
          Copy
        </button>
      </div>
      <pre className={`${styles.payloadArea} font-mono`}>
        {jsonString}
      </pre>
    </div>
  )
}
