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
  mmsiList: number[]
}

export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
}
