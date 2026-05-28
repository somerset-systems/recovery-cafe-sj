import { useMember } from '../hooks/useMember.js'
import ProgressRing from '../components/ProgressRing.jsx'
import Card from '../components/Card.jsx'
import SectionLabel from '../components/SectionLabel.jsx'
import { colors, fontSize } from '../theme.js'

function statusMessage(done) {
  if (done === 0) return 'Sign up for chores at the front desk'
  if (done < 3) return "Keep going — you're almost there!"
  return 'Amazing! You hit your goal this month! 🎉'
}

export default function Chores() {
  const { member, loading, error } = useMember()

  if (loading) return <Loading />
  if (error) return <Err message={error} />
  if (!member) return <Err message="Could not load your profile." />

  const celebrating = member.chores_done >= member.chores_goal

  return (
    <div
      style={{
        background: colors.background,
        minHeight: 'calc(100dvh - 148px)',
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

        <ProgressRing
          value={member.chores_done}
          goal={member.chores_goal}
          size={200}
          celebrating={celebrating}
        />

        <p
          style={{
            margin: '24px 0 8px',
            fontSize: fontSize.xlarge,
            fontWeight: 700,
            color: colors.textDark,
            textAlign: 'center',
          }}
        >
          {member.chores_done} of {member.chores_goal} chores
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
          {statusMessage(member.chores_done)}
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
