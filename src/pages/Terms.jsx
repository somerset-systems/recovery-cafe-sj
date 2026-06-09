import { Link } from 'react-router-dom'
import { colors, fontSize } from '../theme.js'

const LOGO_URL = 'https://recoverycafesj.org/wp-content/uploads/2024/05/rcsj_logo.png'

export default function Terms() {
  return (
    <div style={{ background: colors.background, minHeight: '100dvh' }}>
      <div
        style={{
          background: colors.primaryGreen,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <img
          src={LOGO_URL}
          alt="Recovery Cafe SJ"
          style={{ width: 64, height: 'auto', background: colors.white, borderRadius: 6, padding: '4px 6px' }}
        />
        <span style={{ color: colors.white, fontSize: fontSize.medium, fontWeight: 700 }}>
          Recovery Cafe San Jose
        </span>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 48px' }}>
        <h1 style={{ fontSize: fontSize.xlarge, color: colors.textDark, marginBottom: 8 }}>
          Terms of Service
        </h1>
        <p style={{ fontSize: fontSize.small, color: colors.textLight, marginBottom: 32 }}>
          Last updated: June 2026
        </p>

        <Section title="Who This App Is For">
          This app is for members of Recovery Cafe San Jose only. If you are not currently a
          member of Recovery Cafe SJ, please do not use this app. To become a member, visit us
          at the cafe and speak with staff.
        </Section>

        <Section title="What the App Does">
          This app lets Recovery Cafe SJ members view their recovery circle information, check
          their chore progress, and see upcoming events at the cafe. Members cannot submit,
          edit, or delete any information. All data is managed by Recovery Cafe SJ staff.
        </Section>

        <Section title="Login and Account Access">
          You access the app using only your phone number. There are no passwords. If your phone
          number is not recognized, ask a staff member for help. Do not share your phone number
          with others for the purpose of giving them access to your account.
        </Section>

        <Section title="SMS Messages">
          By using this app, you agree to receive SMS (text) messages from Recovery Cafe SJ for
          the purpose of verifying your identity at login. These messages are sent only when you
          initiate a login. Message and data rates may apply depending on your phone plan.
          <br /><br />
          To opt out of SMS messages, contact a Recovery Cafe SJ staff member or email{' '}
          <a
            href="mailto:tommy@recoverycafesj.org"
            style={{ color: colors.primaryGreen, fontWeight: 600 }}
          >
            tommy@recoverycafesj.org
          </a>
          . Note that opting out of SMS will require an alternative way for staff to verify
          your identity.
        </Section>

        <Section title="Appropriate Use">
          You agree to use this app only for its intended purpose: viewing your own recovery
          information. You agree not to attempt to access another member's information or
          interfere with the app in any way.
        </Section>

        <Section title="Availability">
          This app is provided as-is to support Recovery Cafe SJ members. We may update,
          pause, or discontinue the app at any time. We are not responsible for any
          inconvenience caused by downtime or changes.
        </Section>

        <Section title="Changes to These Terms">
          We may update these terms from time to time. Continued use of the app means you
          accept any updated terms.
        </Section>

        <Section title="Contact">
          Questions about these terms? Contact us at{' '}
          <a
            href="mailto:tommy@recoverycafesj.org"
            style={{ color: colors.primaryGreen, fontWeight: 600 }}
          >
            tommy@recoverycafesj.org
          </a>
          .
        </Section>

        <div style={{ marginTop: 40, borderTop: `1px solid ${colors.border}`, paddingTop: 24 }}>
          <Link
            to="/login"
            style={{ color: colors.primaryGreen, fontSize: fontSize.body, fontWeight: 600 }}
          >
            &larr; Back to app
          </Link>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2
        style={{
          fontSize: fontSize.medium,
          color: colors.primaryGreen,
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {title}
      </h2>
      <p style={{ fontSize: fontSize.body, color: colors.textDark, lineHeight: 1.6, margin: 0 }}>
        {children}
      </p>
    </div>
  )
}
