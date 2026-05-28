import { useNavigate } from 'react-router-dom'
import { useMember } from '../hooks/useMember.js'
import Card from '../components/Card.jsx'
import SectionLabel from '../components/SectionLabel.jsx'
import { colors, fontSize } from '../theme.js'

export default function Profile() {
  const { member, loading, error } = useMember()
  const navigate = useNavigate()

  function handleSignOut() {
    localStorage.removeItem('memberId')
    navigate('/login')
  }

  if (loading) return <Loading />
  if (error) return <Err message={error} />
  if (!member) return <Err message="Could not load your profile." />

  return (
    <div
      style={{
        background: colors.background,
        minHeight: 'calc(100dvh - 148px)',
        padding: '20px 16px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Member info card */}
      <Card>
        <SectionLabel label="Member" />
        <p style={{ margin: '0 0 20px 0', fontSize: fontSize.xlarge, fontWeight: 700, color: colors.textDark }}>
          {member.full_name}
        </p>

        <SectionLabel label="Your Circle" />
        <p style={{ margin: '0 0 2px 0', fontSize: fontSize.medium, fontWeight: 600, color: colors.textDark }}>
          {member.circle_day} Circle
        </p>
        <p style={{ margin: '0 0 2px 0', fontSize: fontSize.body, color: colors.textMedium }}>
          {member.circle_time}
        </p>
        <p style={{ margin: 0, fontSize: fontSize.body, color: colors.textMedium }}>
          Led by {member.circle_leader}
        </p>
      </Card>

      <div style={{ flex: 1 }} />

      <button
        onClick={handleSignOut}
        style={{
          height: 54,
          borderRadius: 14,
          border: `1.5px solid ${colors.danger}`,
          background: 'transparent',
          color: colors.danger,
          fontSize: fontSize.large,
          fontWeight: 600,
          cursor: 'pointer',
          width: '100%',
        }}
      >
        Sign Out
      </button>
    </div>
  )
}

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ color: colors.textMedium, fontSize: fontSize.body }}>Loading…</p>
    </div>
  )
}

function Err({ message }) {
  return <div style={{ padding: 24 }}><p style={{ color: colors.danger }}>{message}</p></div>
}
