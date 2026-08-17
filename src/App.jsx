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
import StaffPreviewBanner, { STAFF_BANNER_HEIGHT } from './components/StaffPreviewBanner.jsx'
import { isStaffPreview, clearStaffSession } from './lib/staffSession.js'
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
    clearStaffSession() // an expired staff preview must not linger into the next login
    return <Navigate to="/login" replace />
  }
  return children
}

function AppShell() {
  const { member } = useMember()
  const { pathname } = useLocation()
  const isLogin = pathname === '/login'
  const isStatic = pathname === '/privacy' || pathname === '/terms'

  // Staff preview pushes everything down by the banner's height. Read per render (not
  // once at module load) so it turns on the moment a staff member finishes logging in.
  const showBanner = isStaffPreview() && !isLogin && !isStatic
  const topOffset = showBanner ? STAFF_BANNER_HEIGHT : 0

  return (
    <>
      {showBanner && <StaffPreviewBanner />}
      {!isLogin && !isStatic && <Header memberName={member?.full_name} topOffset={topOffset} />}
      <main
        style={{
          paddingTop: isLogin || isStatic ? 0 : 104 + topOffset,
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
