// netlify/functions/circle-location.js
// GET /api/circle-location?leader=NAME  (redirected via netlify.toml)

import { findCircleLocation } from './_calendar.js'

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

export const handler = async (event) => {
  try {
    const leader = (event.queryStringParameters?.leader || '').trim()

    if (!leader) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ error: 'Missing ?leader= query param' }),
      }
    }

    const location = await findCircleLocation(leader)
    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ location }),
    }
  } catch (err) {
    console.error('[circle-location] unhandled error:', err)
    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ location: null, error: err.message, stack: err.stack }),
    }
  }
}
