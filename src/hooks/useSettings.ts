import { useState, useEffect } from 'react'

interface Settings {
  apiKey: string
  refreshRate: number
  showNames: boolean
  filterTypes: string[]
  myBoatMmsi: string
}

const STORAGE_KEY = 'marinemates_settings'

const defaultSettings: Settings = {
  apiKey: import.meta.env.VITE_AISSTREAM_API_KEY ?? '',
  refreshRate: 15,
  showNames: true,
  filterTypes: [],
  myBoatMmsi: import.meta.env.VITE_MY_BOAT_MMSI ?? '',
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings
    } catch {
      return defaultSettings
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const updateSettings = (partial: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...partial }))
  }

  return { settings, updateSettings }
}
