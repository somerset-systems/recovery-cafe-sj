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
import Privacy from './pages/Privacy.jsx'
import Terms from './pages/Terms.jsx'
import BadgesPreview from './pages/BadgesPreview.jsx'
import { colors } from './theme.js'

const SESSION_TTL = 30 * 24 * 60 * 60 * 1000 // 30 days in ms

function RequireAuth({ children }) {
  const memberId = localStorage.getItem('memberId')
  const loginAt  = parseInt(localStorage.getItem('loginAt') || '0', 10)

  // loginAt === 0 means an old session with no timestamp stored — treat as valid
  // so existing users aren't force-logged-out on the first deploy.
  const expired = loginAt > 0 && (Date.now() - loginAt) > SESSION_TTL

  if (!memberId || expired) {
    localStorage.removeItem('memberId')
    localStorage.removeItem('loginAt')
    return <Navigate to="/login" replace />
  }
  return children
}

function AppShell() {
  const { member } = useMember()
  const { pathname } = useLocation()
  const isLogin = pathname === '/login'
  const isStatic = pathname === '/privacy' || pathname === '/terms'

  return (
    <>
      {!isLogin && !isStatic && <Header memberName={member?.full_name} />}
      <main
        style={{
          paddingTop: isLogin || isStatic ? 0 : 104,
          paddingBottom: isLogin || isStatic ? 0 : 60,
          background: colors.background,
          minHeight: '100dvh',
          boxSizing: 'border-box',
        }}
      >
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/badges-preview" element={<BadgesPreview />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
          <Route path="/events" element={<RequireAuth><Events /></RequireAuth>} />
          <Route path="/circle" element={<RequireAuth><Circle /></RequireAuth>} />
          <Route path="/chores" element={<RequireAuth><Chores /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isLogin && !isStatic && <BottomNav />}
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
