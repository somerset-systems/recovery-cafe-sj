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

  /* Chore crown: each star pops in (staggered) after the ring fills, then drifts
     in a soft idle twinkle. The newest star lands a touch bigger and brighter. */
  .crown-star {
    opacity: 0;
    animation:
      crownStarIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both,
      crownTwinkle 3.6s ease-in-out 1.6s infinite;
  }
  .crown-star-newest { filter: drop-shadow(0 0 3px rgba(244, 180, 0, 0.65)); }
  @keyframes crownStarIn {
    from { opacity: 0; transform: scale(0) rotate(-40deg); }
    to   { opacity: 1; transform: scale(1) rotate(0deg); }
  }
  @keyframes crownTwinkle {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.72; }
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
