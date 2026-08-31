import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MOBILE_BOTTOM_NAV_HEIGHT, NavBar } from './components/NavBar'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { color, label } from './lib/tokens'
import { useIsMobile } from './lib/useIsMobile'
import { ContactDetail } from './screens/ContactDetail'
import { Import } from './screens/Import'
import { Network } from './screens/Network'
import { Profile } from './screens/Profile'
import { Pulse } from './screens/Pulse'
import { Welcome } from './screens/Welcome'

function AppRoutes() {
  const isMobile = useIsMobile()
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ ...label, color: color.muted }}>Loading…</span>
      </div>
    )
  }

  if (!user) return <Welcome />

  return (
    <>
      <NavBar />
      <div
        style={{
          paddingBottom: isMobile
            ? `calc(${MOBILE_BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))`
            : 0,
        }}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/network" replace />} />
          <Route path="/network" element={<Network />} />
          <Route path="/import" element={<Import />} />
          <Route path="/pulse" element={<Pulse />} />
          <Route path="/contact/:id" element={<ContactDetail />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </div>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
