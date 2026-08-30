import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { ContactDetail } from './screens/ContactDetail'
import { Import } from './screens/Import'
import { Network } from './screens/Network'
import { Profile } from './screens/Profile'
import { Pulse } from './screens/Pulse'

function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <Routes>
        <Route path="/" element={<Navigate to="/network" replace />} />
        <Route path="/network" element={<Network />} />
        <Route path="/import" element={<Import />} />
        <Route path="/pulse" element={<Pulse />} />
        <Route path="/contact/:id" element={<ContactDetail />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
