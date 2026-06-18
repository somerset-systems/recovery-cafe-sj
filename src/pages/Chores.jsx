import { useMember } from '../hooks/useMember.js'
import ChoreRing from '../components/ChoreRing.jsx'
import Card from '../components/Card.jsx'
import SectionLabel from '../components/SectionLabel.jsx'
import { colors, fontSize } from '../theme.js'

function statusMessage(done, goal) {
  if (done === 0) return 'Sign up for chores at the front desk'
  if (done < goal) return "Keep going, you're almost there!"
  if (done === goal) return 'Amazing! You hit your goal this month! 🎉'
  return 'Amazing! You went above and beyond this month! 🎉'
}

export default function Chores() {
  const { member, loading, error } = useMember()

  if (loading) return <Loading />
  if (error) return <Err message={error} />
  if (!member) return <Err message="Could not load your profile." />

  const done = member.chores_done
  const goal = member.chores_goal
  const celebrating = done >= goal
  const extra = Math.max(0, done - goal)

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

        <div style={{ width: '100%', maxWidth: 240 }}>
          <ChoreRing value={done} goal={goal} size={240} />
        </div>

        <p
          style={{
            margin: '24px 0 8px',
            fontSize: fontSize.xlarge,
            fontWeight: 700,
            color: colors.textDark,
            textAlign: 'center',
          }}
        >
          {extra > 0 ? `${done} chores this month` : `${done} of ${goal} chores`}
        </p>

        <p
          style={{
            margin: 0,
            fontSize: fontSize.medium,
            color: celebrating ? colors.accentGreen : colors.textMedium,
            textAlign: 'center',
            fontWeight: celebrating ? 600 : 400,
            lineHeight: 1.4,
          }}
        >
          {statusMessage(done, goal)}
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
