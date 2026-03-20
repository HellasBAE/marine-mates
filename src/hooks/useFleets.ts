import { useState, useEffect, useCallback } from 'react'
import type { Fleet } from '../types'

const API = ''

interface ApiFleet {
  id: string
  name: string
  vessels: { id: string; mmsi: number; nickname: string | null }[]
}

function toFleet(f: ApiFleet): Fleet {
  return { id: f.id, name: f.name, mmsiList: f.vessels.map((v) => v.mmsi) }
}

export function useFleets() {
  const [fleets, setFleets] = useState<Fleet[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/fleets`)
      const data: ApiFleet[] = await res.json()
      setFleets(data.map(toFleet))
    } catch (err) {
      console.error('[useFleets] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addFleet = useCallback(async (name: string) => {
    const res = await fetch(`${API}/api/fleets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data: ApiFleet = await res.json()
    setFleets((prev) => [...prev, toFleet(data)])
    return data.id
  }, [])

  const renameFleet = useCallback(async (fleetId: string, name: string) => {
    await fetch(`${API}/api/fleets/${fleetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setFleets((prev) => prev.map((f) => (f.id === fleetId ? { ...f, name } : f)))
  }, [])

  const deleteFleet = useCallback(async (fleetId: string) => {
    await fetch(`${API}/api/fleets/${fleetId}`, { method: 'DELETE' })
    setFleets((prev) => prev.filter((f) => f.id !== fleetId))
  }, [])

  const addToFleet = useCallback(async (fleetId: string, mmsi: number) => {
    await fetch(`${API}/api/fleets/${fleetId}/vessels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mmsi }),
    })
    setFleets((prev) =>
      prev.map((f) =>
        f.id === fleetId && !f.mmsiList.includes(mmsi)
          ? { ...f, mmsiList: [...f.mmsiList, mmsi] }
          : f
      )
    )
  }, [])

  const removeFromFleet = useCallback(async (fleetId: string, mmsi: number) => {
    await fetch(`${API}/api/fleets/${fleetId}/vessels/${mmsi}`, { method: 'DELETE' })
    setFleets((prev) =>
      prev.map((f) =>
        f.id === fleetId ? { ...f, mmsiList: f.mmsiList.filter((m) => m !== mmsi) } : f
      )
    )
  }, [])

  const isTracked = useCallback(
    (mmsi: number) => fleets.some((f) => f.mmsiList.includes(mmsi)),
    [fleets]
  )

  return {
    fleets,
    fleetsLoading: loading,
    addFleet,
    renameFleet,
    deleteFleet,
    addToFleet,
    removeFromFleet,
    isTracked,
  }
}
