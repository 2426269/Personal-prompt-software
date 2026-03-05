import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout'

// Placeholder pages
import { Collection } from './pages/Collection'
import { Detail } from './pages/Detail'
import { Favorites } from './pages/Favorites'
import { Gallery } from './pages/Gallery'
import { Settings } from './pages/Settings'
import { Testing } from './pages/Testing'
import { Workflows } from './pages/Workflows'

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Gallery />} />
          <Route path="collection" element={<Collection />} />
          <Route path="favorites" element={<Favorites />} />
          <Route path="workflows" element={<Workflows />} />
          <Route path="testing" element={<Testing />} />
          <Route path="settings" element={<Settings />} />
          <Route path="entry/:id" element={<Detail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
