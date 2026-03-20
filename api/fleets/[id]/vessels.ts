import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@libsql/client'

function getDb() {
  const url = (process.env.TURSO_DATABASE_URL || '').trim()
  const authToken = (process.env.TURSO_AUTH_TOKEN || '').trim()
  return createClient({ url, authToken })
}

function genId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const db = getDb()
  const fleetId = req.query.id as string

  // POST /api/fleets/:id/vessels — add vessel to fleet
  if (req.method === 'POST') {
    const { mmsi, nickname } = req.body
    if (typeof mmsi !== 'number') { res.status(400).json({ error: 'mmsi (number) required' }); return }
    const id = genId()
    await db.execute({
      sql: 'INSERT INTO tracked_vessel (id, mmsi, nickname, fleetId) VALUES (?, ?, ?, ?) ON CONFLICT(fleetId, mmsi) DO UPDATE SET nickname = excluded.nickname',
      args: [id, mmsi, nickname ?? null, fleetId],
    })
    const vessel = await db.execute({ sql: 'SELECT * FROM tracked_vessel WHERE fleetId = ? AND mmsi = ?', args: [fleetId, mmsi] })
    res.status(201).json(vessel.rows[0])
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
