import { Link } from 'react-router-dom'
import { colors, fontSize } from '../theme.js'

const LOGO_URL = 'https://recoverycafesj.org/wp-content/uploads/2024/05/rcsj_logo.png'

export default function Privacy() {
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
          Privacy Policy
        </h1>
        <p style={{ fontSize: fontSize.small, color: colors.textLight, marginBottom: 32 }}>
          Last updated: June 2026
        </p>

        <Section title="Overview">
          This app is provided by Recovery Cafe San Jose to help our members view their recovery
          circle, chore progress, and upcoming events. We take your privacy seriously and only
          collect what is needed to make the app work.
        </Section>

        <Section title="What Data We Collect">
          We collect and store the following information:
          <ul style={listStyle}>
            <li>Your name</li>
            <li>Your phone number (used only for login)</li>
            <li>Your recovery circle assignment</li>
            <li>Your attendance record for your circle</li>
            <li>Your chore completion count for the current month</li>
          </ul>
          This information is entered and maintained by Recovery Cafe SJ staff, not by you
          directly.
        </Section>

        <Section title="How We Use Your Data">
          Your data is used only to:
          <ul style={listStyle}>
            <li>Allow you to log in to the app using your phone number</li>
            <li>Display your personal recovery circle, attendance, and chore information</li>
            <li>Show you upcoming events at the cafe</li>
          </ul>
          We do not use your data for advertising, research, or any other purpose.
        </Section>

        <Section title="SMS Messages">
          Recovery Cafe SJ may send SMS (text) messages to your phone number for the sole
          purpose of verifying your identity when you log in. These messages contain a one-time
          code only. We will never send promotional or marketing messages. Message and data rates
          may apply. You can opt out at any time by contacting staff.
        </Section>

        <Section title="Data Sharing">
          We do not sell, rent, or share your personal information with any third parties.
          Your data is stored securely and is only accessible to authorized Recovery Cafe SJ
          staff.
        </Section>

        <Section title="Data Security">
          Your data is stored in a secure database (Supabase) with access controls. Only
          staff members who need to update member records can write to the database. The app
          is read-only for members.
        </Section>

        <Section title="Your Rights">
          You may request to view, correct, or delete your information at any time by contacting
          staff directly or emailing us at the address below.
        </Section>

        <Section title="Contact Us">
          If you have any questions about this privacy policy or your data, please contact us:
          <br />
          <a
            href="mailto:tommy@recoverycafesj.org"
            style={{ color: colors.primaryGreen, fontWeight: 600 }}
          >
            tommy@recoverycafesj.org
          </a>
          <br />
          Recovery Cafe San Jose
          <br />
          San Jose, CA
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

const listStyle = {
  marginTop: 8,
  marginBottom: 0,
  paddingLeft: 22,
  lineHeight: 1.8,
}
