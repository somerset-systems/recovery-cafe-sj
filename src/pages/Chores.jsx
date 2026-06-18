import { useMember } from '../hooks/useMember.js'
import ChoreRing from '../components/ChoreRing.jsx'
import Card from '../components/Card.jsx'
import SectionLabel from '../components/SectionLabel.jsx'
import { getRings } from '../lib/choreRings.js'
import { colors, fontSize } from '../theme.js'

// Plain-language progress line. Below the goal it nudges; at and beyond it, it
// names exactly how many chores close the ring they're working on.
function statusMessage(done, goal, ring) {
  if (done === 0) return 'Sign up for chores at the front desk'
  if (done < goal) return "Keep going, you're almost there!"
  if (ring.allClosed) return 'You closed every ring this month — incredible! 🎉'
  if (ring.justClosed) return `You closed your ${ring.justClosed.name} ring! 🎉`
  const n = ring.remaining
  return `${n} more ${n === 1 ? 'chore' : 'chores'} to close your ${ring.activeName} ring!`
}

export default function Chores() {
  const { member, loading, error } = useMember()

  if (loading) return <Loading />
  if (error) return <Err message={error} />
  if (!member) return <Err message="Could not load your profile." />

  const done = member.chores_done
  const goal = member.chores_goal
  const ring = getRings(done)
  const celebrating = done >= goal || !!ring.justClosed || ring.allClosed

  return (
    <div
      style={{
        minHeight: 'calc(100dvh - 164px)',
        padding: '20px 16px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <Card
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '28px 24px 32px',
          gap: 0,
        }}
      >
        <div style={{ alignSelf: 'flex-start', marginBottom: 24 }}>
          <SectionLabel label="Your Chores This Month" />
        </div>

        <div style={{ width: '100%', maxWidth: 288 }}>
          <ChoreRing value={done} goal={goal} size={288} />
        </div>

        <p
          style={{
            margin: '20px 0 8px',
            fontSize: fontSize.xlarge,
            fontWeight: 700,
            color: colors.textDark,
            textAlign: 'center',
          }}
        >
          {done < goal ? `${done} of ${goal} chores` : `${done} chores this month`}
        </p>

        <p
          style={{
            margin: 0,
            fontSize: fontSize.medium,
            color: celebrating ? (ring.activeColor || colors.accentGreen) : colors.textMedium,
            textAlign: 'center',
            fontWeight: celebrating ? 600 : 400,
            lineHeight: 1.4,
          }}
        >
          {statusMessage(done, goal, ring)}
        </p>
      </Card>
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
