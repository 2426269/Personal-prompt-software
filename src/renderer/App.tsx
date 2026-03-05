import { APP_NAME } from '@shared/constants'

export function App() {
  const { electron, node, chrome } = window.api.versions

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
      </section>
    </main>
  )
}
