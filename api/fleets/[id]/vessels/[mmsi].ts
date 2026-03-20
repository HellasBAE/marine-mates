import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../../../db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const db = getDb()
  const fleetId = req.query.id as string
  const mmsi = parseInt(req.query.mmsi as string, 10)

  // DELETE /api/fleets/:id/vessels/:mmsi
  if (req.method === 'DELETE') {
    await db.execute({ sql: 'DELETE FROM tracked_vessel WHERE fleetId = ? AND mmsi = ?', args: [fleetId, mmsi] })
    res.status(204).end()
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
