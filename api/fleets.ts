import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from './db'

function genId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const db = getDb()

  // GET /api/fleets — list all fleets with vessels
  if (req.method === 'GET') {
    const fleets = await db.execute('SELECT * FROM fleet ORDER BY createdAt ASC')
    const result = []
    for (const fleet of fleets.rows) {
      const vessels = await db.execute({ sql: 'SELECT * FROM tracked_vessel WHERE fleetId = ?', args: [fleet.id as string] })
      result.push({ ...fleet, vessels: vessels.rows })
    }
    res.json(result)
    return
  }

  // POST /api/fleets — create a fleet
  if (req.method === 'POST') {
    const { name } = req.body
    if (!name) { res.status(400).json({ error: 'name required' }); return }
    const id = genId()
    await db.execute({ sql: 'INSERT INTO fleet (id, name) VALUES (?, ?)', args: [id, name] })
    const fleet = await db.execute({ sql: 'SELECT * FROM fleet WHERE id = ?', args: [id] })
    res.status(201).json({ ...fleet.rows[0], vessels: [] })
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
