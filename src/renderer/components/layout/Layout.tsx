import { APP_NAME } from '@shared/constants'
import { NavLink, Outlet } from 'react-router-dom'
import styles from './Layout.module.css'

const NAV_ITEMS = [
  { path: '/', label: '图库浏览', icon: '🖼️' },
  { path: '/collection', label: '提示词集', icon: '📝' },
  { path: '/favorites', label: '收藏', icon: '⭐' },
  { path: '/workflows', label: '工作流', icon: '🔧' },
  { path: '/testing', label: '测试', icon: '🚀' },
  { path: '/settings', label: '设置', icon: '⚙️' },
]

export function Layout() {
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.logoIcon} />
          <span className={styles.brandText}>{APP_NAME}</span>
        </div>
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className={styles.mainContent}>
        <Outlet />
      </main>
    </div>
  )
}
