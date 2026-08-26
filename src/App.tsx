import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { Import } from './screens/Import'
import { Network } from './screens/Network'
import { Todo } from './screens/Todo'

function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <Routes>
        <Route path="/" element={<Navigate to="/network" replace />} />
        <Route path="/network" element={<Network />} />
        <Route path="/import" element={<Import />} />
        <Route path="/pulse" element={<Todo name="Pulse" />} />
        <Route path="/contact/:id" element={<Todo name="Contact detail" />} />
        <Route path="/profile" element={<Todo name="Profile" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
