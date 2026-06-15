#!/usr/bin/env node
// api/_dev.js — local development server for Vercel functions
// Run with:  node api/_dev.js
// Vite proxies /api/* to this server (port 3747).
//
// Prefixed with _ so Vercel does not expose it as a route.

import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// Load .env from project root (mirrors what Vite does for the frontend)
const envPath = join(ROOT, '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!(key in process.env)) process.env[key] = val
  }
  console.log('[dev] Loaded .env')
}

// Lazy-import handlers so env is populated before module-level code runs
const { default: eventsHandler }         = await import('./events.js')
const { default: circleLocationHandler } = await import('./circle-location.js')
const { default: sendCodeHandler }       = await import('./send-code.js')
const { default: verifyCodeHandler }     = await import('./verify-code.js')

const PORT = 3747

const server = createServer((req, res) => {
  const path = req.url?.split('?')[0]

  if (path === '/api/events') {
    eventsHandler(req, res)
  } else if (path === '/api/circle-location') {
    circleLocationHandler(req, res)
  } else if (path === '/api/send-code') {
    sendCodeHandler(req, res)
  } else if (path === '/api/verify-code') {
    verifyCodeHandler(req, res)
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: `Unknown route: ${path}` }))
  }
})

server.listen(PORT, () => {
  console.log(`[dev] API server running on http://localhost:${PORT}`)
  console.log(`[dev] Test with: curl http://localhost:${PORT}/api/events`)
})
