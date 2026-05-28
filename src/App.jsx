import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useMember } from './hooks/useMember.js'
import Header from './components/Header.jsx'
import BottomNav from './components/BottomNav.jsx'
import Login from './pages/Login.jsx'
import Home from './pages/Home.jsx'
import Events from './pages/Events.jsx'
import Circle from './pages/Circle.jsx'
import Chores from './pages/Chores.jsx'
import Profile from './pages/Profile.jsx'
import { colors } from './theme.js'

function RequireAuth({ children }) {
  const memberId = localStorage.getItem('memberId')
  if (!memberId) return <Navigate to="/login" replace />
  return children
}

function AppShell() {
  const { member } = useMember()
  const { pathname } = useLocation()
  const isLogin = pathname === '/login'

  return (
    <>
      {!isLogin && <Header memberName={member?.full_name} />}
      <main
        style={{
          paddingTop: isLogin ? 0 : 88,
          paddingBottom: isLogin ? 0 : 60,
          background: colors.background,
          minHeight: '100dvh',
          boxSizing: 'border-box',
        }}
      >
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
          <Route path="/events" element={<RequireAuth><Events /></RequireAuth>} />
          <Route path="/circle" element={<RequireAuth><Circle /></RequireAuth>} />
          <Route path="/chores" element={<RequireAuth><Chores /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isLogin && <BottomNav />}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
