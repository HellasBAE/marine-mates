import { useState, useEffect, useRef, useCallback } from 'react'
import type { Vessel, MapBounds } from '../types'
import { fetchVessels, fetchCachedVessels, connectAISStream, trackMyBoat } from '../api'

const REFRESH_INTERVAL = 15_000
const POLL_INTERVAL = 10_000

// Poll the serverless AIS endpoint (for production where browser WS is blocked)
async function pollAIS(
  apiKey: string,
  bounds: MapBounds,
  mmsi?: string,
): Promise<Vessel[]> {
  try {
    const params = new URLSearchParams({
      south: String(bounds.south),
      north: String(bounds.north),
      west: String(bounds.west),
      east: String(bounds.east),
      duration: '5',
    })
    if (mmsi) params.set('mmsi', mmsi)
    const res = await fetch(`/api/ais?${params}`)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export function useVessels(bounds: MapBounds, apiKey: string, myBoatMmsi?: string) {
  const [vessels, setVessels] = useState<Map<number, Vessel>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [liveCount, setLiveCount] = useState(0)
  const [cachedCount, setCachedCount] = useState(0)
  const disconnectRef = useRef<(() => void) | null>(null)
  const boundsRef = useRef<MapBounds>(bounds)
  const liveMMSIs = useRef(new Set<number>())

  useEffect(() => {
    boundsRef.current = bounds
  }, [bounds])

  // Demo mode: poll for vessel data
  const loadVessels = useCallback(async () => {
    try {
      const data = await fetchVessels(boundsRef.current)
      setVessels((prev) => {
        const next = new Map(prev)
        data.forEach((v) => next.set(v.mmsi, v))
        return next
      })
      setLoading(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch vessels')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    disconnectRef.current?.()
    disconnectRef.current = null
    liveMMSIs.current.clear()
    setLiveCount(0)
    setCachedCount(0)

    if (!apiKey) {
      setIsLive(false)
      loadVessels()
      const interval = setInterval(loadVessels, REFRESH_INTERVAL)
      return () => clearInterval(interval)
    }

    setIsLive(true)
    setLoading(true)
    setError(null)

    const b = boundsRef.current
    const latPad = (b.north - b.south) * 0.5
    const lngPad = (b.east - b.west) * 0.5
    const wideBounds: MapBounds = {
      north: Math.min(90, b.north + latPad),
      south: Math.max(-90, b.south - latPad),
      east: Math.min(180, b.east + lngPad),
      west: Math.max(-180, b.west - lngPad),
    }

    // Load cached vessels for instant display
    fetchCachedVessels(wideBounds).then((cached) => {
        if (cached.length > 0) {
          setVessels((prev) => {
            const next = new Map(prev)
            cached.forEach((v) => {
              if (!next.has(v.mmsi) || next.get(v.mmsi)?.isCached) {
                next.set(v.mmsi, v)
              }
            })
            return next
          })
          setCachedCount(cached.length)
          setLoading(false)
        }
      })

    let disposed = false

    if (import.meta.env.DEV) {
      // Dev mode: use WebSocket through Vite proxy
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null

      const connect = () => {
        if (disposed) return
        disconnectRef.current = connectAISStream(
          apiKey,
          wideBounds,
          (vessel) => {
            vessel.isCached = false
            setVessels((prev) => {
              const next = new Map(prev)
              next.set(vessel.mmsi, vessel)
              return next
            })
            if (!liveMMSIs.current.has(vessel.mmsi)) {
              liveMMSIs.current.add(vessel.mmsi)
              setLiveCount(liveMMSIs.current.size)
            }
            setLoading(false)
            setError(null)
          },
          (errMsg) => {
            if (!disposed) {
              setError(`${errMsg} — reconnecting...`)
              reconnectTimer = setTimeout(connect, 5000)
            }
          }
        )
      }

      const startDelay = setTimeout(connect, 1500)

      return () => {
        clearTimeout(startDelay)
        disposed = true
        disconnectRef.current?.()
        disconnectRef.current = null
        if (reconnectTimer) clearTimeout(reconnectTimer)
      }
    } else {
      // Production: poll the serverless /api/ais endpoint
      let pollTimer: ReturnType<typeof setInterval> | null = null

      const doPoll = async () => {
        if (disposed) return
        try {
          const data = await pollAIS(apiKey, wideBounds)
          if (disposed) return
          setVessels((prev) => {
            const next = new Map(prev)
            data.forEach((v) => {
              next.set(v.mmsi, v)
              if (!liveMMSIs.current.has(v.mmsi)) {
                liveMMSIs.current.add(v.mmsi)
              }
            })
            return next
          })
          setLiveCount(liveMMSIs.current.size)
          setLoading(false)
          setError(null)
        } catch {
          if (!disposed) setError('Failed to poll AIS data')
        }
      }

      // First poll immediately
      doPoll()
      pollTimer = setInterval(doPoll, POLL_INTERVAL)

      return () => {
        disposed = true
        if (pollTimer) clearInterval(pollTimer)
      }
    }
  }, [apiKey, loadVessels])

  // Track user's boat
  useEffect(() => {
    if (!apiKey || !myBoatMmsi) return

    if (import.meta.env.DEV) {
      // Dev: WebSocket
      const timer = setTimeout(() => {
        const disconnect = trackMyBoat(apiKey, myBoatMmsi, (vessel) => {
          vessel.isCached = false
          setVessels((prev) => {
            const next = new Map(prev)
            next.set(vessel.mmsi, vessel)
            return next
          })
        })
        cleanupRef.current = disconnect
      }, 2000)
      const cleanupRef = { current: () => {} }
      return () => { clearTimeout(timer); cleanupRef.current() }
    } else {
      // Production: poll with MMSI filter
      let disposed = false
      const poll = async () => {
        if (disposed) return
        const data = await pollAIS(apiKey, { south: -90, north: 90, west: -180, east: 180 }, myBoatMmsi)
        if (disposed) return
        setVessels((prev) => {
          const next = new Map(prev)
          data.forEach((v) => next.set(v.mmsi, v))
          return next
        })
      }
      poll()
      const timer = setInterval(poll, POLL_INTERVAL)
      return () => { disposed = true; clearInterval(timer) }
    }
  }, [apiKey, myBoatMmsi])

  const vesselList = Array.from(vessels.values())

  return {
    vessels: vesselList,
    loading,
    error,
    isLive,
    vesselCount: vesselList.length,
    liveCount,
    cachedCount,
  }
}
