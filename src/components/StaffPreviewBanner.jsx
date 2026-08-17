import { colors, fontSize } from '../theme.js'

// Height is exported because the fixed header and the page body both have to sit
// below this banner — see App.jsx.
export const STAFF_BANNER_HEIGHT = 44

/**
 * Persistent "this is not real" bar for a staff preview session.
 *
 * Fixed to the very top of every screen and never dismissable. It sits above the green
 * header rather than inside it so it survives scrolling and stays in any screenshot a
 * staff member takes to show someone else — the failure we most want to avoid is a
 * staff screenshot circulating as if it were a real member's chore count.
 */
export default function StaffPreviewBanner() {
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: STAFF_BANNER_HEIGHT,
        background: colors.previewBg,
        color: colors.previewText,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '0 16px',
        zIndex: 200, // above the header (100)
        boxSizing: 'border-box',
        textAlign: 'center',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: fontSize.medium }}>👁</span>
      <span style={{ fontSize: fontSize.body, fontWeight: 700, lineHeight: 1.2 }}>
        STAFF PREVIEW — not a real member
      </span>
    </div>
  )
}
