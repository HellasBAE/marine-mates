import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@libsql/client'

function getDb() {
  const url = (process.env.TURSO_DATABASE_URL || '').trim()
  const authToken = (process.env.TURSO_AUTH_TOKEN || '').trim()
  return createClient({ url, authToken })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const db = getDb()
  const id = req.query.id as string

  // PATCH /api/fleets/:id — rename
  if (req.method === 'PATCH') {
    const { name } = req.body
    if (!name) { res.status(400).json({ error: 'name required' }); return }
    await db.execute({ sql: 'UPDATE fleet SET name = ? WHERE id = ?', args: [name, id] })
    const fleet = await db.execute({ sql: 'SELECT * FROM fleet WHERE id = ?', args: [id] })
    if (fleet.rows.length === 0) { res.status(404).json({ error: 'not found' }); return }
    const vessels = await db.execute({ sql: 'SELECT * FROM tracked_vessel WHERE fleetId = ?', args: [id] })
    res.json({ ...fleet.rows[0], vessels: vessels.rows })
    return
  }

  // DELETE /api/fleets/:id
  if (req.method === 'DELETE') {
    await db.execute({ sql: 'DELETE FROM tracked_vessel WHERE fleetId = ?', args: [id] })
    await db.execute({ sql: 'DELETE FROM fleet WHERE id = ?', args: [id] })
    res.status(204).end()
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
