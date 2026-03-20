import type { VercelRequest, VercelResponse } from '@vercel/node'
import { WebSocket } from 'ws'
import { getDb } from './db.js'

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

interface Vessel {
  mmsi: number; name: string; lat: number; lng: number
  speed: number; course: number; heading: number; shipType: string
  destination: string; status: string; lastUpdate: string; flag: string
  length: number; width: number; callsign: string; imo: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = (req.query.apiKey as string) || process.env.VITE_AISSTREAM_API_KEY || ''
  const south = parseFloat(req.query.south as string) || -90
  const north = parseFloat(req.query.north as string) || 90
  const west = parseFloat(req.query.west as string) || -180
  const east = parseFloat(req.query.east as string) || 180
  const duration = Math.min(parseInt(req.query.duration as string) || 5, 10) // max 10s
  const mmsi = req.query.mmsi as string || ''

  if (!apiKey) {
    res.status(400).json({ error: 'No API key' })
    return
  }

  const vessels = new Map<number, Vessel>()

  await new Promise<void>((resolve) => {
    const ws = new WebSocket('wss://stream.aisstream.io/v0/stream')
    const timer = setTimeout(() => { ws.close(); resolve() }, duration * 1000)

    ws.on('open', () => {
      const sub: Record<string, unknown> = {
        APIKey: apiKey,
        BoundingBoxes: [[[south, west], [north, east]]],
        FilterMessageTypes: ['PositionReport', 'StandardClassBPositionReport'],
      }
      if (mmsi) sub.FiltersShipMMSI = mmsi.split(',')
      ws.send(JSON.stringify(sub))
    })

    ws.on('message', (data) => {
      try {
        const raw = data.toString('utf8')
        const msg = JSON.parse(raw)
        const meta = msg.MetaData
        if (!meta) return
        const pos = msg.Message?.PositionReport ?? msg.Message?.StandardClassBPositionReport
        if (!pos) return
        vessels.set(meta.MMSI, {
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
        })
      } catch { /* skip */ }
    })

    ws.on('error', () => { clearTimeout(timer); resolve() })
    ws.on('close', () => { clearTimeout(timer); resolve() })
  })

  // Cache vessel positions in Turso
  const vesselArr = Array.from(vessels.values())
  if (vesselArr.length > 0 && process.env.TURSO_DATABASE_URL) {
    try {
      const db = getDb()
      for (const v of vesselArr) {
        await db.execute({
          sql: `INSERT INTO vessel_cache (mmsi, name, lat, lng, speed, course, heading, shipType, destination, status, lastUpdate, flag, length, width, callsign, imo, cachedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(mmsi) DO UPDATE SET
                  name=excluded.name, lat=excluded.lat, lng=excluded.lng,
                  speed=excluded.speed, course=excluded.course, heading=excluded.heading,
                  shipType=excluded.shipType, destination=excluded.destination, status=excluded.status,
                  lastUpdate=excluded.lastUpdate, flag=excluded.flag, length=excluded.length,
                  width=excluded.width, callsign=excluded.callsign, imo=excluded.imo,
                  cachedAt=datetime('now')`,
          args: [v.mmsi, v.name, v.lat, v.lng, v.speed, v.course, v.heading, v.shipType, v.destination, v.status, v.lastUpdate, v.flag, v.length, v.width, v.callsign, v.imo],
        })
      }
    } catch { /* cache write failure is non-critical */ }
  }

  res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10')
  res.json(vesselArr)
}
