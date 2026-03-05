import { useState } from 'react'

import { APP_NAME } from '@shared/constants'

export function App() {
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
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">{APP_NAME}</div>
        <nav>
          <a className="nav-item active">图库浏览</a>
          <a className="nav-item">提示词集</a>
          <a className="nav-item">收藏</a>
          <a className="nav-item">工作流</a>
          <a className="nav-item">测试</a>
          <a className="nav-item">设置</a>
        </nav>
      </aside>
      <section className="content">
        <h1>Phase 0 Scaffold Ready</h1>
        <p>Main/Preload/Renderer architecture initialized.</p>
        <p className="runtime">Electron {electron} · Node {node} · Chrome {chrome}</p>
        <div className="ping-box">
          <button className="ping-btn" onClick={() => void handlePing()} type="button">
            Ping Main Process
          </button>
          <p className="ping-text">{pingState}</p>
        </div>
      </section>
    </main>
  )
}
