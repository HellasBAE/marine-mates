export interface Vessel {
  mmsi: number
  name: string
  lat: number
  lng: number
  speed: number       // knots
  course: number      // degrees
  heading: number     // degrees
  shipType: string
  destination: string
  status: string
  lastUpdate: string  // ISO timestamp
  flag: string
  length: number
  width: number
  callsign: string
  imo: number
  isCached?: boolean  // true if loaded from cache, not yet live
}

export interface Fleet {
  id: string
  name: string
  color: string
  mmsiList: number[]
}

export const FLEET_COLORS = [
  '#1e88e5', // blue (default)
  '#e91e63', // pink
  '#4caf50', // green
  '#ff9800', // orange
  '#9c27b0', // purple
  '#00bcd4', // cyan
  '#f44336', // red
  '#ffeb3b', // yellow
  '#795548', // brown
  '#607d8b', // slate
]

export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
}
