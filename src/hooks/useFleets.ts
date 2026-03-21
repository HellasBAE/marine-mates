import { useState, useEffect, useCallback } from 'react'
import type { Fleet } from '../types'
import { FLEET_COLORS } from '../types'

const STORAGE_KEY = 'marinemates_fleets'
const API = '/api'

// Check if backend is available (dev mode with server running)
let backendAvailable: boolean | null = null

async function checkBackend(): Promise<boolean> {
  if (backendAvailable !== null) return backendAvailable
  try {
    const res = await fetch(`${API}/fleets`, { signal: AbortSignal.timeout(2000) })
    backendAvailable = res.ok
  } catch {
    backendAvailable = false
  }
  return backendAvailable
}

// localStorage helpers
function loadLocal(): Fleet[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.length > 0) return parsed
    }
  } catch { /* ignore */ }
  return [{ id: 'default', name: 'Aphrodite Fleet', color: '#1e88e5', mmsiList: [] }]
}

function saveLocal(fleets: Fleet[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fleets))
}

function genId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

interface ApiFleet {
  id: string
  name: string
  color?: string
  vessels: { id: string; mmsi: number; nickname: string | null }[]
}

function toFleet(f: ApiFleet, index: number): Fleet {
  return { id: f.id, name: f.name, color: f.color || FLEET_COLORS[index % FLEET_COLORS.length], mmsiList: f.vessels.map((v) => v.mmsi) }
}

export function useFleets() {
  const [fleets, setFleets] = useState<Fleet[]>(loadLocal)
  const [useApi, setUseApi] = useState(false)

  // On mount, check if backend is available
  useEffect(() => {
    checkBackend().then((available) => {
      if (available) {
        setUseApi(true)
        fetch(`${API}/fleets`)
          .then((r) => r.json())
          .then((data: ApiFleet[]) => setFleets(data.map((f, i) => toFleet(f, i))))
          .catch(() => { /* keep localStorage data */ })
      }
    })
  }, [])

  // Persist to localStorage whenever fleets change
  useEffect(() => {
    saveLocal(fleets)
  }, [fleets])

  const addFleet = useCallback(async (name: string) => {
    if (useApi) {
      try {
        const res = await fetch(`${API}/fleets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })
        const data: ApiFleet = await res.json()
        setFleets((prev) => {
          const fleet = toFleet(data, prev.length)
          return [...prev, fleet]
        })
        return data.id
      } catch { /* fall through to local */ }
    }
    const id = genId()
    setFleets((prev) => {
      const color = FLEET_COLORS[prev.length % FLEET_COLORS.length]
      return [...prev, { id, name, color, mmsiList: [] }]
    })
    return id
  }, [useApi])

  const renameFleet = useCallback(async (fleetId: string, name: string) => {
    if (useApi) {
      try {
        await fetch(`${API}/fleets/${fleetId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })
      } catch { /* local only */ }
    }
    setFleets((prev) => prev.map((f) => (f.id === fleetId ? { ...f, name } : f)))
  }, [useApi])

  const setFleetColor = useCallback((fleetId: string, color: string) => {
    setFleets((prev) => prev.map((f) => (f.id === fleetId ? { ...f, color } : f)))
  }, [])

  const deleteFleet = useCallback(async (fleetId: string) => {
    if (useApi) {
      try { await fetch(`${API}/fleets/${fleetId}`, { method: 'DELETE' }) } catch { /* local only */ }
    }
    setFleets((prev) => prev.filter((f) => f.id !== fleetId))
  }, [useApi])

  const addToFleet = useCallback(async (fleetId: string, mmsi: number) => {
    if (useApi) {
      try {
        await fetch(`${API}/fleets/${fleetId}/vessels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mmsi }),
        })
      } catch { /* local only */ }
    }
    setFleets((prev) =>
      prev.map((f) =>
        f.id === fleetId && !f.mmsiList.includes(mmsi)
          ? { ...f, mmsiList: [...f.mmsiList, mmsi] }
          : f
      )
    )
  }, [useApi])

  const removeFromFleet = useCallback(async (fleetId: string, mmsi: number) => {
    if (useApi) {
      try { await fetch(`${API}/fleets/${fleetId}/vessels/${mmsi}`, { method: 'DELETE' }) } catch { /* local only */ }
    }
    setFleets((prev) =>
      prev.map((f) =>
        f.id === fleetId ? { ...f, mmsiList: f.mmsiList.filter((m) => m !== mmsi) } : f
      )
    )
  }, [useApi])

  const isTracked = useCallback(
    (mmsi: number) => fleets.some((f) => f.mmsiList.includes(mmsi)),
    [fleets]
  )

  return {
    fleets,
    fleetsLoading: false,
    addFleet,
    renameFleet,
    setFleetColor,
    deleteFleet,
    addToFleet,
    removeFromFleet,
    isTracked,
  }
}
