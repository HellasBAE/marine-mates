import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const dbPath = join(__dirname, '..', '..', 'prisma', 'dev.db')

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const app = express()
const server = createServer(app)
const PORT = 3001

app.use(cors())
app.use(express.json())

// ──────────────────────────────────────────────
// AIS lookup tables (same as frontend api.ts)
// ──────────────────────────────────────────────

const SHIP_TYPES: Record<number, string> = {
  0: 'Unknown', 20: 'Wing in Ground', 30: 'Fishing', 31: 'Towing',
  32: 'Towing (large)', 33: 'Dredging', 34: 'Diving Ops', 35: 'Military Ops',
  36: 'Sailing', 37: 'Pleasure Craft', 40: 'High Speed Craft', 50: 'Pilot Vessel',
  51: 'Search & Rescue', 52: 'Tug', 53: 'Port Tender', 55: 'Law Enforcement',
  58: 'Medical Transport', 60: 'Passenger', 70: 'Cargo', 80: 'Tanker', 90: 'Other',
}

const NAV_STATUSES: Record<number, string> = {
  0: 'Under way using engine', 1: 'At anchor', 2: 'Not under command',
  3: 'Restricted manoeuvrability', 4: 'Constrained by draught', 5: 'Moored',
  6: 'Aground', 7: 'Engaged in fishing', 8: 'Under way sailing',
  14: 'AIS-SART', 15: 'Not defined',
}

function resolveShipType(code: number): string {
  return SHIP_TYPES[code] || SHIP_TYPES[Math.floor(code / 10) * 10] || 'Unknown'
}

function resolveNavStatus(code: number): string {
  return NAV_STATUSES[code] || 'Unknown'
}

// ──────────────────────────────────────────────
// DB setup
// ──────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS fleet (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS tracked_vessel (
    id TEXT PRIMARY KEY,
    mmsi INTEGER NOT NULL,
    nickname TEXT,
    fleetId TEXT NOT NULL REFERENCES fleet(id) ON DELETE CASCADE,
    addedAt TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(fleetId, mmsi)
  );
  CREATE TABLE IF NOT EXISTS vessel_cache (
    mmsi INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    speed REAL NOT NULL DEFAULT 0,
    course REAL NOT NULL DEFAULT 0,
    heading REAL NOT NULL DEFAULT 0,
    shipType TEXT NOT NULL DEFAULT 'Unknown',
    destination TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '',
    lastUpdate TEXT NOT NULL,
    flag TEXT NOT NULL DEFAULT '',
    length REAL NOT NULL DEFAULT 0,
    width REAL NOT NULL DEFAULT 0,
    callsign TEXT NOT NULL DEFAULT '',
    imo INTEGER NOT NULL DEFAULT 0,
    cachedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_vessel_cache_lat_lng ON vessel_cache(lat, lng);
  CREATE INDEX IF NOT EXISTS idx_vessel_cache_name ON vessel_cache(name COLLATE NOCASE);
`)

function genId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// Seed default fleet if empty
const fleetCount = db.prepare('SELECT COUNT(*) as c FROM fleet').get() as { c: number }
if (fleetCount.c === 0) {
  db.prepare('INSERT INTO fleet (id, name) VALUES (?, ?)').run('default', 'My Fleet')
  console.log('[server] Created default "My Fleet"')
}

// ──────────────────────────────────────────────
// Vessel cache — batched upserts
// ──────────────────────────────────────────────

interface CachedVessel {
  mmsi: number; name: string; lat: number; lng: number
  speed: number; course: number; heading: number; shipType: string
  destination: string; status: string; lastUpdate: string; flag: string
  length: number; width: number; callsign: string; imo: number
}

const pendingUpserts = new Map<number, CachedVessel>()

const upsertStmt = db.prepare(`
  INSERT INTO vessel_cache (mmsi, name, lat, lng, speed, course, heading, shipType, destination, status, lastUpdate, flag, length, width, callsign, imo, cachedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  ON CONFLICT(mmsi) DO UPDATE SET
    name=excluded.name, lat=excluded.lat, lng=excluded.lng,
    speed=excluded.speed, course=excluded.course, heading=excluded.heading,
    shipType=excluded.shipType, destination=excluded.destination, status=excluded.status,
    lastUpdate=excluded.lastUpdate, flag=excluded.flag, length=excluded.length,
    width=excluded.width, callsign=excluded.callsign, imo=excluded.imo,
    cachedAt=datetime('now')
`)

const flushUpserts = db.transaction(() => {
  for (const v of pendingUpserts.values()) {
    upsertStmt.run(
      v.mmsi, v.name, v.lat, v.lng, v.speed, v.course, v.heading,
      v.shipType, v.destination, v.status, v.lastUpdate, v.flag,
      v.length, v.width, v.callsign, v.imo
    )
  }
  const count = pendingUpserts.size
  pendingUpserts.clear()
  return count
})

// Flush every 2 seconds
setInterval(() => {
  if (pendingUpserts.size > 0) {
    const count = flushUpserts()
    if (count > 0) console.log(`[cache] Flushed ${count} vessel positions`)
  }
}, 2000)

// Clean up stale entries every hour
setInterval(() => {
  const result = db.prepare("DELETE FROM vessel_cache WHERE cachedAt < datetime('now', '-24 hours')").run()
  if (result.changes > 0) console.log(`[cache] Cleaned ${result.changes} stale entries`)
}, 3600 * 1000)

function parseAISMessage(raw: string): CachedVessel | null {
  try {
    const data = JSON.parse(raw)
    const meta = data.MetaData
    if (!meta) return null
    const pos = data.Message?.PositionReport ?? data.Message?.StandardClassBPositionReport
    if (!pos) return null
    return {
      mmsi: meta.MMSI,
      name: (meta.ShipName || '').trim() || `MMSI ${meta.MMSI}`,
      lat: pos.Latitude,
      lng: pos.Longitude,
      speed: pos.Sog ?? 0,
      course: pos.Cog ?? 0,
      heading: pos.TrueHeading ?? pos.Cog ?? 0,
      shipType: resolveShipType(meta.ShipType ?? 0),
      destination: (meta.Destination || '').trim(),
      status: resolveNavStatus(pos.NavigationalStatus ?? 15),
      lastUpdate: meta.time_utc || new Date().toISOString(),
      flag: meta.country ?? '',
      length: meta.length ?? 0,
      width: meta.width ?? 0,
      callsign: (meta.CallSign || '').trim(),
      imo: meta.IMO ?? 0,
    }
  } catch {
    return null
  }
}

// ──────────────────────────────────────────────
// REST API — Fleets
// ──────────────────────────────────────────────

interface FleetRow { id: string; name: string; createdAt: string }
interface VesselRow { id: string; mmsi: number; nickname: string | null; fleetId: string; addedAt: string }

function getFleetWithVessels(fleet: FleetRow) {
  const vessels = db.prepare('SELECT * FROM tracked_vessel WHERE fleetId = ?').all(fleet.id) as VesselRow[]
  return { ...fleet, vessels }
}

app.get('/api/fleets', (_req, res) => {
  const fleets = db.prepare('SELECT * FROM fleet ORDER BY createdAt ASC').all() as FleetRow[]
  res.json(fleets.map(getFleetWithVessels))
})

app.post('/api/fleets', (req, res) => {
  const { name } = req.body
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name is required' })
    return
  }
  const id = genId()
  db.prepare('INSERT INTO fleet (id, name) VALUES (?, ?)').run(id, name)
  const fleet = db.prepare('SELECT * FROM fleet WHERE id = ?').get(id) as FleetRow
  res.status(201).json(getFleetWithVessels(fleet))
})

app.patch('/api/fleets/:id', (req, res) => {
  const { name } = req.body
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name is required' })
    return
  }
  db.prepare('UPDATE fleet SET name = ? WHERE id = ?').run(name, req.params.id)
  const fleet = db.prepare('SELECT * FROM fleet WHERE id = ?').get(req.params.id) as FleetRow
  if (!fleet) { res.status(404).json({ error: 'not found' }); return }
  res.json(getFleetWithVessels(fleet))
})

app.delete('/api/fleets/:id', (req, res) => {
  db.prepare('DELETE FROM fleet WHERE id = ?').run(req.params.id)
  res.status(204).end()
})

// ──────────────────────────────────────────────
// REST API — Tracked Vessels
// ──────────────────────────────────────────────

app.post('/api/fleets/:id/vessels', (req, res) => {
  const { mmsi, nickname } = req.body
  if (typeof mmsi !== 'number') {
    res.status(400).json({ error: 'mmsi (number) is required' })
    return
  }
  const id = genId()
  db.prepare(
    'INSERT INTO tracked_vessel (id, mmsi, nickname, fleetId) VALUES (?, ?, ?, ?) ON CONFLICT(fleetId, mmsi) DO UPDATE SET nickname = excluded.nickname'
  ).run(id, mmsi, nickname ?? null, req.params.id)
  const vessel = db.prepare('SELECT * FROM tracked_vessel WHERE fleetId = ? AND mmsi = ?').get(req.params.id, mmsi) as VesselRow
  res.status(201).json(vessel)
})

app.delete('/api/fleets/:id/vessels/:mmsi', (req, res) => {
  const mmsi = parseInt(req.params.mmsi, 10)
  db.prepare('DELETE FROM tracked_vessel WHERE fleetId = ? AND mmsi = ?').run(req.params.id, mmsi)
  res.status(204).end()
})

// ──────────────────────────────────────────────
// REST API — Vessel Cache
// ──────────────────────────────────────────────

// Get cached vessels in a bounding box
app.get('/api/vessels', (req, res) => {
  const boundsStr = req.query.bounds as string
  if (!boundsStr) {
    res.status(400).json({ error: 'bounds=south,west,north,east required' })
    return
  }
  const parts = boundsStr.split(',').map(Number)
  if (parts.length !== 4 || parts.some(isNaN)) {
    res.status(400).json({ error: 'bounds must be 4 numbers: south,west,north,east' })
    return
  }
  const [south, west, north, east] = parts
  const rows = db.prepare(
    `SELECT * FROM vessel_cache
     WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
     AND cachedAt > datetime('now', '-24 hours')
     LIMIT 500`
  ).all(south, north, west, east)
  res.json(rows)
})

// Search vessels by name/callsign/MMSI in the cache
app.get('/api/vessels/search', (req, res) => {
  const q = (req.query.q as string || '').trim()
  if (!q || q.length < 2) {
    res.json([])
    return
  }
  const rows = db.prepare(
    `SELECT * FROM vessel_cache
     WHERE (name LIKE ? OR callsign LIKE ? OR CAST(mmsi AS TEXT) LIKE ? OR destination LIKE ?)
     AND cachedAt > datetime('now', '-24 hours')
     ORDER BY name COLLATE NOCASE
     LIMIT 50`
  ).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
  res.json(rows)
})

// ──────────────────────────────────────────────
// WebSocket proxy — AISStream (with cache interception)
// ──────────────────────────────────────────────

const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ais-ws') {
    wss.handleUpgrade(req, socket, head, (clientWs) => {
      const upstream = new WebSocket('wss://stream.aisstream.io/v0/stream')
      const pending: Buffer[] = []

      clientWs.on('message', (data) => {
        if (upstream.readyState === WebSocket.OPEN) {
          upstream.send(data)
        } else {
          pending.push(Buffer.from(data as ArrayBuffer))
        }
      })

      upstream.on('open', () => {
        for (const msg of pending) upstream.send(msg)
        pending.length = 0
      })

      upstream.on('message', (data) => {
        const str = data.toString('utf8')

        // Cache the vessel position
        const vessel = parseAISMessage(str)
        if (vessel) {
          pendingUpserts.set(vessel.mmsi, vessel)
        }

        // Forward to browser
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(str)
        }
      })

      upstream.on('close', (code, reason) => {
        const safeCode = code >= 1000 && code <= 4999 ? code : 1000
        try { clientWs.close(safeCode, reason) } catch { /* already closed */ }
      })

      upstream.on('error', () => {
        try { clientWs.close(1011, 'Upstream error') } catch { /* already closed */ }
      })

      clientWs.on('close', () => {
        try { upstream.close() } catch { /* already closed */ }
      })

      clientWs.on('error', () => {
        try { upstream.close() } catch { /* already closed */ }
      })
    })
  }
})

// ──────────────────────────────────────────────
// Start
// ──────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[server] API + WS proxy listening on http://localhost:${PORT}`)
})
