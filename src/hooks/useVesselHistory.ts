import { useState, useEffect } from 'react'
import type { VesselHistoryPoint } from '../types'
import { fetchVesselHistory } from '../api'

export function useVesselHistory(mmsi: number | null, hours = 24) {
  const [history, setHistory] = useState<VesselHistoryPoint[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!mmsi) {
      setHistory([])
      return
    }
    setLoading(true)
    fetchVesselHistory(mmsi, hours)
      .then(setHistory)
      .finally(() => setLoading(false))
  }, [mmsi, hours])

  return { history, loading }
}
