import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MOBILE_BOTTOM_NAV_HEIGHT, NavBar } from './components/NavBar'
import { useIsMobile } from './lib/useIsMobile'
import { Admin } from './screens/Admin'
import { ContactDetail } from './screens/ContactDetail'
import { Import } from './screens/Import'
import { Network } from './screens/Network'
import { Profile } from './screens/Profile'
import { Pulse } from './screens/Pulse'

function App() {
  const isMobile = useIsMobile()

  return (
    <BrowserRouter>
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
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
