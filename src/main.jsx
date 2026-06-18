import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Single global reset — no CSS files beyond this
const style = document.createElement('style')
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
  button { font-family: inherit; }
  input { font-family: inherit; }
  a, a:link, a:visited, a:any-link { color: inherit !important; text-decoration: none !important; }

  /* Chores extra-credit badge: a gentle gold-star pop after the ring fills. */
  @keyframes extraCreditPop {
    from { opacity: 0; transform: translateY(8px) scale(0.92); }
    to   { opacity: 1; transform: translateY(0)   scale(1); }
  }

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
