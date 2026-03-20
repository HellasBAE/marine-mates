import type { Vessel, MapBounds } from './types'

const SHIP_TYPES: Record<number, string> = {
  0: 'Unknown',
  20: 'Wing in Ground',
  30: 'Fishing',
  31: 'Towing',
  32: 'Towing (large)',
  33: 'Dredging',
  34: 'Diving Ops',
  35: 'Military Ops',
  36: 'Sailing',
  37: 'Pleasure Craft',
  40: 'High Speed Craft',
  50: 'Pilot Vessel',
  51: 'Search & Rescue',
  52: 'Tug',
  53: 'Port Tender',
  55: 'Law Enforcement',
  58: 'Medical Transport',
  60: 'Passenger',
  70: 'Cargo',
  80: 'Tanker',
  90: 'Other',
}

const NAV_STATUSES: Record<number, string> = {
  0: 'Under way using engine',
  1: 'At anchor',
  2: 'Not under command',
  3: 'Restricted manoeuvrability',
  4: 'Constrained by draught',
  5: 'Moored',
  6: 'Aground',
  7: 'Engaged in fishing',
  8: 'Under way sailing',
  14: 'AIS-SART',
  15: 'Not defined',
}

function resolveShipType(typeCode: number): string {
  // Ship type is encoded in ranges: 60-69 = Passenger, 70-79 = Cargo, etc.
  const baseType = Math.floor(typeCode / 10) * 10
  return SHIP_TYPES[typeCode] || SHIP_TYPES[baseType] || 'Unknown'
}

function resolveNavStatus(statusCode: number): string {
  return NAV_STATUSES[statusCode] || 'Unknown'
}

// Using the free AISHub API or fallback to demo data
// AISHub provides free AIS data: https://www.aishub.net/
// You can also use MarineTraffic or VesselFinder APIs (paid)

// In dev, Vite proxies /ais-ws to the backend.
// In production, connect directly to the AISStream WebSocket.
const AISSTREAM_WS = import.meta.env.DEV
  ? `ws://${window.location.host}/ais-ws`
  : 'wss://stream.aisstream.io/v0/stream'

// Demo vessels for when no API key is configured
function generateDemoVessels(bounds: MapBounds): Vessel[] {
  const vessels: Vessel[] = [
    {
      mmsi: 311001001,
      name: 'ISLAND LINK',
      lat: 24.17,
      lng: -76.44,
      speed: 8.5,
      course: 170,
      heading: 168,
      shipType: 'Passenger',
      destination: 'NASSAU',
      status: 'Under way using engine',
      lastUpdate: new Date().toISOString(),
      flag: 'BS',
      length: 58,
      width: 14,
      callsign: 'C6AB1',
      imo: 9123456,
    },
    {
      mmsi: 311001002,
      name: 'EXUMA FREIGHT',
      lat: 24.25,
      lng: -76.50,
      speed: 6.2,
      course: 315,
      heading: 313,
      shipType: 'Cargo',
      destination: 'GEORGE TOWN',
      status: 'Under way using engine',
      lastUpdate: new Date().toISOString(),
      flag: 'BS',
      length: 85,
      width: 16,
      callsign: 'C6CD2',
      imo: 9234567,
    },
    {
      mmsi: 311001003,
      name: 'BAHAMA DREAMER',
      lat: 24.15,
      lng: -76.38,
      speed: 5.0,
      course: 90,
      heading: 88,
      shipType: 'Sailing',
      destination: 'STANIEL CAY',
      status: 'Under way sailing',
      lastUpdate: new Date().toISOString(),
      flag: 'US',
      length: 14,
      width: 4,
      callsign: 'WDA1234',
      imo: 0,
    },
    {
      mmsi: 311001004,
      name: 'THUNDERBALL',
      lat: 24.16,
      lng: -76.43,
      speed: 0.0,
      course: 0,
      heading: 220,
      shipType: 'Pleasure Craft',
      destination: 'STANIEL CAY',
      status: 'At anchor',
      lastUpdate: new Date().toISOString(),
      flag: 'US',
      length: 22,
      width: 6,
      callsign: 'WDB5678',
      imo: 0,
    },
    {
      mmsi: 311001005,
      name: 'NASSAU TANKER III',
      lat: 24.30,
      lng: -76.60,
      speed: 9.8,
      course: 135,
      heading: 133,
      shipType: 'Tanker',
      destination: 'NASSAU',
      status: 'Under way using engine',
      lastUpdate: new Date().toISOString(),
      flag: 'BS',
      length: 140,
      width: 22,
      callsign: 'C6EF3',
      imo: 9345678,
    },
    {
      mmsi: 311001006,
      name: 'CONCH FISHER',
      lat: 24.12,
      lng: -76.48,
      speed: 3.1,
      course: 45,
      heading: 43,
      shipType: 'Fishing',
      destination: 'BLACK POINT',
      status: 'Engaged in fishing',
      lastUpdate: new Date().toISOString(),
      flag: 'BS',
      length: 12,
      width: 4,
      callsign: 'C6GH4',
      imo: 0,
    },
    {
      mmsi: 311001007,
      name: 'EXUMA EXPRESS',
      lat: 24.08,
      lng: -76.35,
      speed: 22.5,
      course: 340,
      heading: 338,
      shipType: 'High Speed Craft',
      destination: 'STANIEL CAY',
      status: 'Under way using engine',
      lastUpdate: new Date().toISOString(),
      flag: 'BS',
      length: 30,
      width: 8,
      callsign: 'C6IJ5',
      imo: 9456789,
    },
    {
      mmsi: 311001008,
      name: 'SEA BREEZE',
      lat: 24.22,
      lng: -76.52,
      speed: 6.8,
      course: 200,
      heading: 198,
      shipType: 'Sailing',
      destination: 'WARDERICK WELLS',
      status: 'Under way sailing',
      lastUpdate: new Date().toISOString(),
      flag: 'CA',
      length: 16,
      width: 5,
      callsign: 'VCK123',
      imo: 0,
    },
    {
      mmsi: 311001009,
      name: 'HARBOUR TUG 7',
      lat: 24.18,
      lng: -76.45,
      speed: 0.0,
      course: 0,
      heading: 90,
      shipType: 'Tug',
      destination: 'STANIEL CAY',
      status: 'Moored',
      lastUpdate: new Date().toISOString(),
      flag: 'BS',
      length: 18,
      width: 7,
      callsign: 'C6KL6',
      imo: 0,
    },
    {
      mmsi: 311001010,
      name: 'COMPASS CAY DIVER',
      lat: 24.26,
      lng: -76.41,
      speed: 4.5,
      course: 260,
      heading: 258,
      shipType: 'Pleasure Craft',
      destination: 'COMPASS CAY',
      status: 'Under way using engine',
      lastUpdate: new Date().toISOString(),
      flag: 'US',
      length: 10,
      width: 3,
      callsign: 'WDC9012',
      imo: 0,
    },
    {
      mmsi: 311001011,
      name: 'PILOT NASSAU',
      lat: 24.20,
      lng: -76.40,
      speed: 1.5,
      course: 180,
      heading: 178,
      shipType: 'Pilot Vessel',
      destination: 'STANIEL CAY',
      status: 'Under way using engine',
      lastUpdate: new Date().toISOString(),
      flag: 'BS',
      length: 12,
      width: 4,
      callsign: 'C6MN7',
      imo: 0,
    },
    {
      mmsi: 311001012,
      name: 'CARIBBEAN STAR',
      lat: 24.05,
      lng: -76.55,
      speed: 11.2,
      course: 30,
      heading: 28,
      shipType: 'Passenger',
      destination: 'GEORGE TOWN',
      status: 'Under way using engine',
      lastUpdate: new Date().toISOString(),
      flag: 'BS',
      length: 72,
      width: 16,
      callsign: 'C6OP8',
      imo: 9567890,
    },
  ]

  // Add slight random movement to simulate live updates
  return vessels
    .filter(
      (v) =>
        v.lat >= bounds.south &&
        v.lat <= bounds.north &&
        v.lng >= bounds.west &&
        v.lng <= bounds.east
    )
    .map((v) => ({
      ...v,
      lat: v.lat + (Math.random() - 0.5) * 0.01,
      lng: v.lng + (Math.random() - 0.5) * 0.01,
      speed: Math.max(0, v.speed + (Math.random() - 0.5) * 0.5),
    }))
}

export interface AISStreamConfig {
  apiKey: string
}

// WebSocket-based live AIS stream
export function connectAISStream(
  apiKey: string,
  bounds: MapBounds,
  onVessel: (vessel: Vessel) => void,
  onError: (error: string) => void
): () => void {
  let intentionallyClosed = false
  let didOpen = false
  const ws = new WebSocket(AISSTREAM_WS)

  ws.onopen = () => {
    didOpen = true
    const subscribeMsg = {
      APIKey: apiKey,
      BoundingBoxes: [
        [
          [bounds.south, bounds.west],
          [bounds.north, bounds.east],
        ],
      ],
      FilterMessageTypes: ['PositionReport', 'StandardClassBPositionReport'],
    }
    console.log('[MarineMates] WS connected, subscribing:', JSON.stringify(subscribeMsg))
    ws.send(JSON.stringify(subscribeMsg))
  }

  ws.onmessage = (event) => {
    try {
      const raw = typeof event.data === 'string' ? event.data : ''
      const data = JSON.parse(raw)

      // Handle error responses from the API
      if (data.ERROR || data.error) {
        const msg = data.ERROR || data.error
        console.error('[MarineMates] API error:', msg)
        onError(`AIS API error: ${msg}`)
        return
      }

      const meta = data.MetaData
      if (!meta) {
        console.log('[MarineMates] Message without MetaData:', raw.slice(0, 200))
        return
      }

      // Extract position from whichever message type we received
      const pos =
        data.Message?.PositionReport ??
        data.Message?.StandardClassBPositionReport

      if (pos) {
        const vessel: Vessel = {
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
        onVessel(vessel)
      }
    } catch {
      // skip malformed messages
    }
  }

  ws.onerror = (evt) => {
    console.error('[MarineMates] WS error:', evt)
    if (!intentionallyClosed) {
      onError('WebSocket connection error')
    }
  }

  ws.onclose = (event) => {
    console.warn('[MarineMates] WS closed:', { code: event.code, reason: event.reason, didOpen })
    if (!intentionallyClosed) {
      if (!didOpen) {
        onError('Could not connect to AIS stream — check your network/API key')
      } else if (event.code === 1008 || event.reason?.toLowerCase().includes('api')) {
        onError('Invalid API key — check your AISStream key in Settings')
      } else {
        onError(`Connection lost (code ${event.code}) — reconnecting...`)
      }
    }
  }

  return () => {
    intentionallyClosed = true
    ws.close()
  }
}

// Track a single vessel by MMSI globally (separate connection)
export function trackMyBoat(
  apiKey: string,
  mmsi: string,
  onVessel: (vessel: Vessel) => void
): () => void {
  let intentionallyClosed = false
  const ws = new WebSocket(AISSTREAM_WS)

  ws.onopen = () => {
    const subscribeMsg = {
      APIKey: apiKey,
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FilterMessageTypes: ['PositionReport', 'StandardClassBPositionReport'],
      FiltersShipMMSI: [mmsi],
    }
    ws.send(JSON.stringify(subscribeMsg))
  }

  ws.onmessage = (event) => {
    try {
      const raw = typeof event.data === 'string' ? event.data : ''
      const data = JSON.parse(raw)
      const meta = data.MetaData
      if (!meta) return
      const pos = data.Message?.PositionReport ?? data.Message?.StandardClassBPositionReport
      if (pos) {
        onVessel({
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
      }
    } catch {
      // skip malformed messages
    }
  }

  ws.onerror = () => {}
  ws.onclose = () => {
    if (!intentionallyClosed) {
      setTimeout(() => {
        if (!intentionallyClosed) {
          trackMyBoat(apiKey, mmsi, onVessel)
        }
      }, 10000)
    }
  }

  return () => {
    intentionallyClosed = true
    ws.close()
  }
}

// Fetch demo vessels (or real API if configured)
export async function fetchVessels(bounds: MapBounds): Promise<Vessel[]> {
  return generateDemoVessels(bounds)
}

// In dev, Vite proxies /api to the backend.
const API_BASE = ''

// Fetch cached vessels from the backend for a bounding box
export async function fetchCachedVessels(bounds: MapBounds): Promise<Vessel[]> {
  try {
    const b = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`
    const res = await fetch(`${API_BASE}/api/vessels?bounds=${b}`)
    if (!res.ok) return []
    const rows = await res.json()
    return rows.map((r: Record<string, unknown>) => ({
      mmsi: r.mmsi as number,
      name: r.name as string,
      lat: r.lat as number,
      lng: r.lng as number,
      speed: r.speed as number,
      course: r.course as number,
      heading: r.heading as number,
      shipType: r.shipType as string,
      destination: r.destination as string,
      status: r.status as string,
      lastUpdate: r.lastUpdate as string,
      flag: r.flag as string,
      length: r.length as number,
      width: r.width as number,
      callsign: r.callsign as string,
      imo: r.imo as number,
      isCached: true,
    }))
  } catch {
    return []
  }
}

// Search vessels by name in the backend cache
export async function searchCachedVessels(query: string): Promise<Vessel[]> {
  try {
    const res = await fetch(`${API_BASE}/api/vessels/search?q=${encodeURIComponent(query)}`)
    if (!res.ok) return []
    const rows = await res.json()
    return rows.map((r: Record<string, unknown>) => ({
      mmsi: r.mmsi as number,
      name: r.name as string,
      lat: r.lat as number,
      lng: r.lng as number,
      speed: r.speed as number,
      course: r.course as number,
      heading: r.heading as number,
      shipType: r.shipType as string,
      destination: r.destination as string,
      status: r.status as string,
      lastUpdate: r.lastUpdate as string,
      flag: r.flag as string,
      length: r.length as number,
      width: r.width as number,
      callsign: r.callsign as string,
      imo: r.imo as number,
      isCached: true,
    }))
  } catch {
    return []
  }
}

export function getShipTypeColor(shipType: string): string {
  const colors: Record<string, string> = {
    'Passenger': '#4CAF50',
    'Cargo': '#2196F3',
    'Tanker': '#FF9800',
    'Fishing': '#9C27B0',
    'Tug': '#795548',
    'Sailing': '#00BCD4',
    'Pleasure Craft': '#E91E63',
    'High Speed Craft': '#FF5722',
    'Pilot Vessel': '#FFEB3B',
    'Search & Rescue': '#F44336',
    'Military Ops': '#607D8B',
    'Law Enforcement': '#3F51B5',
  }
  return colors[shipType] || '#9E9E9E'
}
