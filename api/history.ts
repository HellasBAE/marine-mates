import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@libsql/client'

function getDb() {
  return createClient({
    url: (process.env.TURSO_DATABASE_URL || '').trim(),
    authToken: (process.env.TURSO_AUTH_TOKEN || '').trim(),
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const mmsi = parseInt(req.query.mmsi as string, 10)
  if (!mmsi || isNaN(mmsi)) {
    res.status(400).json({ error: 'mmsi required' })
    return
  }

  const hours = Math.min(parseInt(req.query.hours as string) || 24, 168) // max 7 days

  try {
    const db = getDb()

    // Clean up old history (>30 days) opportunistically
    await db.execute({ sql: "DELETE FROM vessel_history WHERE timestamp < datetime('now', '-30 days')", args: [] })

    const rows = await db.execute({
      sql: `SELECT lat, lng, speed, course, heading, status, timestamp
            FROM vessel_history
            WHERE mmsi = ? AND timestamp > datetime('now', '-${hours} hours')
            ORDER BY timestamp ASC`,
      args: [mmsi],
    })

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    res.json(rows.rows)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
}
