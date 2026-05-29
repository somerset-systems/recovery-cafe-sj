// api/circle-location.js — Vercel serverless function
// GET /api/circle-location?leader=NAME
// Returns { location: string | null }

import { findCircleLocation } from './_calendar.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')

  const url    = new URL(req.url, `http://localhost`)
  const leader = url.searchParams.get('leader') || ''

  if (!leader.trim()) {
    res.writeHead(400)
    res.end(JSON.stringify({ error: 'Missing ?leader= query param' }))
    return
  }

  try {
    const location = await findCircleLocation(leader.trim())
    res.writeHead(200)
    res.end(JSON.stringify({ location }))
  } catch (err) {
    console.error('[api/circle-location] error:', err)
    res.writeHead(200)
    res.end(JSON.stringify({ location: null }))
  }
}
