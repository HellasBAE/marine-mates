import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@libsql/client'

function getDb() {
  const url = (process.env.TURSO_DATABASE_URL || '').trim()
  const authToken = (process.env.TURSO_AUTH_TOKEN || '').trim()
  return createClient({ url, authToken })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const db = getDb()

  // GET /api/vessels?bounds=south,west,north,east — cached vessels in area
  if (req.query.bounds) {
    const parts = (req.query.bounds as string).split(',').map(Number)
    if (parts.length !== 4 || parts.some(isNaN)) {
      res.status(400).json({ error: 'bounds must be 4 numbers: south,west,north,east' })
      return
    }
    const [south, west, north, east] = parts
    const rows = await db.execute({
      sql: `SELECT * FROM vessel_cache
            WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
            AND cachedAt > datetime('now', '-24 hours')
            LIMIT 500`,
      args: [south, north, west, east],
    })
    res.json(rows.rows)
    return
  }

  // GET /api/vessels?search=query — search by name/callsign/MMSI
  if (req.query.search) {
    const q = (req.query.search as string).trim()
    if (!q || q.length < 2) { res.json([]); return }
    const rows = await db.execute({
      sql: `SELECT * FROM vessel_cache
            WHERE (name LIKE ? OR callsign LIKE ? OR CAST(mmsi AS TEXT) LIKE ? OR destination LIKE ?)
            AND cachedAt > datetime('now', '-24 hours')
            ORDER BY name COLLATE NOCASE
            LIMIT 50`,
      args: [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`],
    })
    res.json(rows.rows)
    return
  }

  res.status(400).json({ error: 'Provide ?bounds= or ?search= parameter' })
}
