import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { Vessel, Fleet, MapBounds } from '../types'
import { fetchVessels, fetchCachedVessels, connectAISStream, trackMyBoat } from '../api'

const REFRESH_INTERVAL = 15_000
const POLL_INTERVAL = 10_000

// Poll the serverless AIS endpoint
async function pollAIS(
  bounds: MapBounds,
  mmsi?: string,
  trackedMmsis?: string,
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
    if (trackedMmsis) params.set('trackedMmsis', trackedMmsis)
    const res = await fetch(`/api/ais?${params}`)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export function useVessels(bounds: MapBounds, apiKey: string, myBoatMmsi?: string, fleets?: Fleet[]) {
  const [vessels, setVessels] = useState<Map<number, Vessel>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [liveCount, setLiveCount] = useState(0)
  const [cachedCount, setCachedCount] = useState(0)
  const disconnectRef = useRef<(() => void) | null>(null)
  const boundsRef = useRef<MapBounds>(bounds)
  const liveMMSIs = useRef(new Set<number>())

  // Collect all tracked MMSIs (fleets + myBoat)
  const trackedMmsiList = useMemo(() => {
    const set = new Set<number>()
    if (myBoatMmsi) set.add(parseInt(myBoatMmsi, 10))
    if (fleets) {
      for (const fleet of fleets) {
        for (const mmsi of fleet.mmsiList) set.add(mmsi)
      }
    }
    return Array.from(set).filter(Boolean)
  }, [fleets, myBoatMmsi])

  const trackedMmsiKey = trackedMmsiList.sort().join(',')

  useEffect(() => {
    boundsRef.current = bounds
  }, [bounds])

  // Demo mode
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

  // Main area poll
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
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null
      const connect = () => {
        if (disposed) return
        disconnectRef.current = connectAISStream(apiKey, wideBounds, (vessel) => {
          vessel.isCached = false
          setVessels((prev) => { const next = new Map(prev); next.set(vessel.mmsi, vessel); return next })
          if (!liveMMSIs.current.has(vessel.mmsi)) { liveMMSIs.current.add(vessel.mmsi); setLiveCount(liveMMSIs.current.size) }
          setLoading(false); setError(null)
        }, (errMsg) => {
          if (!disposed) { setError(`${errMsg} — reconnecting...`); reconnectTimer = setTimeout(connect, 5000) }
        })
      }
      const startDelay = setTimeout(connect, 1500)
      return () => { clearTimeout(startDelay); disposed = true; disconnectRef.current?.(); disconnectRef.current = null; if (reconnectTimer) clearTimeout(reconnectTimer) }
    } else {
      let pollTimer: ReturnType<typeof setInterval> | null = null
      const doPoll = async () => {
        if (disposed) return
        try {
          // Use current bounds (not the initial ones) so panning works
          const cb = boundsRef.current
          const lp = (cb.north - cb.south) * 0.5
          const lnp = (cb.east - cb.west) * 0.5
          const currentBounds: MapBounds = {
            north: Math.min(90, cb.north + lp),
            south: Math.max(-90, cb.south - lp),
            east: Math.min(180, cb.east + lnp),
            west: Math.max(-180, cb.west - lnp),
          }
          // Fetch cached vessels for the new area too
          const [data, cached] = await Promise.all([
            pollAIS(currentBounds),
            fetchCachedVessels(currentBounds),
          ])
          if (disposed) return
          setVessels((prev) => {
            const next = new Map(prev)
            // Add cached first (lower priority)
            cached.forEach((v) => {
              if (!next.has(v.mmsi) || next.get(v.mmsi)?.isCached) {
                next.set(v.mmsi, v)
              }
            })
            // Then live data (higher priority)
            data.forEach((v) => {
              next.set(v.mmsi, v)
              if (!liveMMSIs.current.has(v.mmsi)) liveMMSIs.current.add(v.mmsi)
            })
            return next
          })
          setLiveCount(liveMMSIs.current.size); setLoading(false); setError(null)
        } catch { if (!disposed) setError('Failed to poll AIS data') }
      }
      doPoll()
      pollTimer = setInterval(doPoll, POLL_INTERVAL)
      return () => { disposed = true; if (pollTimer) clearInterval(pollTimer) }
    }
  }, [apiKey, loadVessels])

  // Global fleet + myBoat poll (always worldwide, with history recording)
  useEffect(() => {
    if (!apiKey || trackedMmsiList.length === 0) return

    let disposed = false

    if (import.meta.env.DEV) {
      // Dev: single WebSocket tracking all fleet MMSIs
      const timer = setTimeout(() => {
        const mmsiStr = trackedMmsiList.map(String)
        // trackMyBoat supports single MMSI; for multiple, we create one connection
        // using the first MMSI and rely on the area stream for others
        // TODO: create a multi-MMSI tracker for dev mode
        const disconnects = mmsiStr.map((m) =>
          trackMyBoat(apiKey, m, (vessel) => {
            vessel.isCached = false
            setVessels((prev) => { const next = new Map(prev); next.set(vessel.mmsi, vessel); return next })
          })
        )
        cleanupRef.current = () => disconnects.forEach((d) => d())
      }, 2000)
      const cleanupRef = { current: () => {} }
      return () => { clearTimeout(timer); cleanupRef.current(); disposed = true }
    } else {
      // Production: poll with all tracked MMSIs
      const mmsiStr = trackedMmsiList.join(',')
      const poll = async () => {
        if (disposed) return
        const data = await pollAIS(
          { south: -90, north: 90, west: -180, east: 180 },
          mmsiStr,
          mmsiStr, // trackedMmsis — tells server to record history
        )
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
  }, [apiKey, trackedMmsiKey]) // eslint-disable-line react-hooks/exhaustive-deps

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
