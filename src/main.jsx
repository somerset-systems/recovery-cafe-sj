import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { colors } from './theme.js'

// Single global reset — no CSS files beyond this
const style = document.createElement('style')
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
  button { font-family: inherit; }
  input { font-family: inherit; }
  /* Links default to inheriting body styling (links are rare in this app), but
     intentional inline link styles must still win — so NO !important here, or it
     clobbers the green underlined Terms/Privacy + mailto links. */
  a { color: inherit; text-decoration: none; }

  /* Visible keyboard focus everywhere (WCAG 2.4.7 Focus Visible). Inputs no longer
     set outline:none inline, so this ring shows on the phone field and code boxes. */
  :focus-visible { outline: 2px solid ${colors.primaryGreen}; outline-offset: 2px; }

  /* Honor reduced-motion everywhere: snap animations/transitions to their end state. */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-delay: 0ms !important;
      transition-duration: 0.01ms !important;
    }
  }
`
document.head.appendChild(style)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
