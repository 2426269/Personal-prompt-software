import { useState } from 'react'

export function Gallery() {
  const { electron, node, chrome } = window.api.versions
  const [pingState, setPingState] = useState('Not tested')

  const handlePing = async () => {
    setPingState('Pinging...')
    const response = await window.api.ping()
    if (!response.success || !response.data) {
      setPingState(`Failed: ${response.error?.code ?? 'UNKNOWN'}`)
      return
    }
    setPingState(`${response.data.message} @ ${response.data.timestamp}`)
  }

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <h1>Phase 0 Scaffold Ready</h1>
      <p>Main/Preload/Renderer architecture initialized.</p>
      <p style={{ color: 'var(--text-secondary)' }}>
        Electron {electron} · Node {node} · Chrome {chrome}
      </p>
      <div style={{ marginTop: 'var(--space-6)' }}>
        <button 
          onClick={() => void handlePing()} 
          style={{ 
            padding: '10px 14px', 
            background: 'var(--accent-blue)', 
            color: 'white', 
            borderRadius: 'var(--radius-sm)' 
          }}
        >
          Ping Main Process
        </button>
        <p style={{ marginTop: 'var(--space-2)', color: 'var(--text-secondary)' }}>
          {pingState}
        </p>
      </div>
    </div>
  )
}
