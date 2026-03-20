import { useState, useEffect, useRef, useCallback } from 'react'
import type { Vessel, MapBounds } from '../types'
import { fetchVessels, fetchCachedVessels, connectAISStream, trackMyBoat } from '../api'

const REFRESH_INTERVAL = 15_000

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

  // Keep bounds ref current without triggering reconnects
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
    // Clean up previous connection
    disconnectRef.current?.()
    disconnectRef.current = null
    liveMMSIs.current.clear()
    setLiveCount(0)
    setCachedCount(0)

    if (!apiKey) {
      // Demo mode with polling
      setIsLive(false)
      loadVessels()
      const interval = setInterval(loadVessels, REFRESH_INTERVAL)
      return () => clearInterval(interval)
    }

    // Live mode with WebSocket
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

    // 1. Load cached vessels immediately for instant display
    fetchCachedVessels(wideBounds).then((cached) => {
      if (cached.length > 0) {
        setVessels((prev) => {
          const next = new Map(prev)
          cached.forEach((v) => {
            // Don't overwrite already-live vessels
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

    // 2. Connect live stream — delay slightly to avoid Firefox killing
    //    WebSocket connections during page load
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let disposed = false

    const connect = () => {
      if (disposed) return

      disconnectRef.current = connectAISStream(
        apiKey,
        wideBounds,
        (vessel) => {
          // Mark as live (not cached)
          vessel.isCached = false

          setVessels((prev) => {
            const next = new Map(prev)
            next.set(vessel.mmsi, vessel)
            return next
          })

          // Track live count
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

    // Wait for page to finish loading before opening WebSocket
    const startDelay = setTimeout(connect, 1500)

    return () => {
      clearTimeout(startDelay)
      disposed = true
      disconnectRef.current?.()
      disconnectRef.current = null
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [apiKey, loadVessels])

  // Dedicated connection to track the user's boat globally
  useEffect(() => {
    if (!apiKey || !myBoatMmsi) return

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
    return () => {
      clearTimeout(timer)
      cleanupRef.current()
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
