import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HostView from './pages/HostView'
import JoinView from './pages/JoinView'
import GuestView from './pages/GuestView'

export default function App() {
  return (
    <BrowserRouter>
      <div className="bg-grid text-ink min-h-screen">
        <Routes>
          <Route path="/" element={<Navigate to="/host" replace />} />
          <Route path="/host" element={<HostView />} />
          <Route path="/join/:roomId" element={<JoinView />} />
          <Route path="/guest/:roomId" element={<GuestView />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
