import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMember } from '../hooks/useMember.js'
import { db } from '../lib/supabase.js'
import { clearStaffSession, isStaffPreview } from '../lib/staffSession.js'
import Card from '../components/Card.jsx'
import SectionLabel from '../components/SectionLabel.jsx'
import BadgesCard from '../components/BadgesCard.jsx'
import { colors, fontSize } from '../theme.js'

export default function Profile() {
  const { member, loading, error } = useMember()
  const navigate = useNavigate()
  const [attendance, setAttendance] = useState([])
  const [choreMonths, setChoreMonths] = useState([])
  const [badgesLoading, setBadgesLoading] = useState(true)

  // Badges derive from durable history: attendance weeks + the monthly chore
  // snapshot. Load both; failures fall back to empty lists rather than blocking.
  useEffect(() => {
    if (!member) return
    let active = true
    Promise.all([
      db.getAttendanceForMember(member.id),
      db.getChoreMonthsForMember(member.id),
    ]).then(([att, chore]) => {
      if (!active) return
      setAttendance(att.data || [])
      setChoreMonths(chore.data || [])
      setBadgesLoading(false)
    })
    return () => { active = false }
  }, [member])

  function handleSignOut() {
    localStorage.removeItem('memberId')
    localStorage.removeItem('loginAt') // clear session timestamp too, matching RequireAuth
    clearStaffSession()                // otherwise the next person on this phone stays in the demo
    navigate('/login')
  }

  if (loading) return <Loading />
  if (error) return <Err message={error} />
  if (!member) return <Err message="Could not load your profile." />

  return (
    <div
      style={{
        minHeight: 'calc(100dvh - 164px)',
        padding: '20px 16px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <Card>
        <SectionLabel label="Member" />
        <p style={{ margin: 0, fontSize: fontSize.xlarge, fontWeight: 700, color: colors.textDark }}>
          {member.full_name}
        </p>
        {/* In staff preview the name above is the staff member's own, so this card would
            otherwise read as a genuine member record. Say plainly that it isn't. */}
        {isStaffPreview() && (
          <p style={{ margin: '6px 0 0 0', fontSize: fontSize.body, fontWeight: 600, color: colors.previewNoticeBorder }}>
            Staff preview — your name on a made-up member's record
          </p>
        )}
      </Card>

      <Card>
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

      <BadgesCard member={member} attendance={attendance} choreMonths={choreMonths} loading={badgesLoading} />

      <div style={{ flex: 1, minHeight: 24 }} />

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

      <p style={{ margin: '14px 0 4px', textAlign: 'center', fontSize: fontSize.small, color: colors.textMedium }}>
        Powered by Somerset Systems
      </p>
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
