import { useState, useCallback, useMemo, useEffect } from 'react'
import type { Vessel, Fleet, MapBounds } from './types'
import { useVessels } from './hooks/useVessels'
import { useSettings } from './hooks/useSettings'
import { useFleets } from './hooks/useFleets'
import { useVesselHistory } from './hooks/useVesselHistory'
import { BoatMap } from './components/BoatMap'
import { VesselPanel } from './components/VesselPanel'
import { VesselList } from './components/VesselList'
import { StatusBar } from './components/StatusBar'
import { SettingsModal } from './components/SettingsModal'

import './App.css'

// Staniel Cay, Bahamas area
const DEFAULT_BOUNDS: MapBounds = {
  north: 25.0,
  south: 23.5,
  east: -75.5,
  west: -77.5,
}

export default function App() {
  const { settings, updateSettings } = useSettings()
  const {
    fleets,
    addFleet,
    renameFleet,
    setFleetColor,
    deleteFleet,
    addToFleet,
    removeFromFleet,
    isTracked,
  } = useFleets()
  const [bounds, setBounds] = useState<MapBounds>(DEFAULT_BOUNDS)
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [fitBounds, setFitBounds] = useState<MapBounds | null>(null)
  const [activeFleetId, setActiveFleetId] = useState<string | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('marinemates_theme') as 'dark' | 'light') || 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('marinemates_theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  const { vessels, loading, error, isLive, vesselCount, liveCount, cachedCount } = useVessels(bounds, settings.apiKey, settings.myBoatMmsi, fleets)

  // Build a map of MMSI -> fleet color
  // If activeFleetId is set and the vessel is in that fleet, use that fleet's color.
  // Otherwise use the first fleet the vessel appears in.
  const vesselFleetColors = useMemo(() => {
    const colors = new Map<number, string>()
    // First pass: assign from first fleet in list order
    for (const fleet of fleets) {
      for (const mmsi of fleet.mmsiList) {
        if (!colors.has(mmsi)) {
          colors.set(mmsi, fleet.color)
        }
      }
    }
    // Second pass: override with active fleet color
    if (activeFleetId) {
      const activeFleet = fleets.find((f) => f.id === activeFleetId)
      if (activeFleet) {
        for (const mmsi of activeFleet.mmsiList) {
          colors.set(mmsi, activeFleet.color)
        }
      }
    }
    return colors
  }, [fleets, activeFleetId])

  // Trail for selected tracked vessel
  const selectedMmsi = selectedVessel?.mmsi ?? null
  const myMmsi = settings.myBoatMmsi ? parseInt(settings.myBoatMmsi, 10) : null
  const selectedIsTracked = selectedMmsi
    ? (isTracked(selectedMmsi) || selectedMmsi === myMmsi)
    : false
  const historyMmsi = selectedIsTracked ? selectedMmsi : null
  const { history: vesselHistory } = useVesselHistory(historyMmsi)
  const trailPoints = useMemo(
    () => vesselHistory.map((p) => [p.lat, p.lng] as [number, number]),
    [vesselHistory]
  )
  const trailColor = selectedMmsi ? vesselFleetColors.get(selectedMmsi) : undefined

  const handleBoundsChange = useCallback((newBounds: MapBounds) => {
    setBounds(newBounds)
  }, [])

  const handleSelectVessel = useCallback((vessel: Vessel | null) => {
    setSelectedVessel(vessel)
    setSidebarOpen(false)
  }, [])

  const handleZoomToFleet = useCallback(
    (fleet: Fleet) => {
      const fleetVessels = fleet.mmsiList
        .map((mmsi) => vessels.find((v) => v.mmsi === mmsi))
        .filter(Boolean) as Vessel[]

      if (fleetVessels.length === 0) return

      if (fleetVessels.length === 1) {
        setSelectedVessel(fleetVessels[0])
        return
      }

      const lats = fleetVessels.map((v) => v.lat)
      const lngs = fleetVessels.map((v) => v.lng)
      const pad = 0.05
      setFitBounds({
        north: Math.max(...lats) + pad,
        south: Math.min(...lats) - pad,
        east: Math.max(...lngs) + pad,
        west: Math.min(...lngs) - pad,
      })
    },
    [vessels]
  )

  const handleFitBoundsConsumed = useCallback(() => {
    setFitBounds(null)
  }, [])

  return (
    <div className="app">
      <StatusBar
        vesselCount={vesselCount}
        isLive={isLive}
        loading={loading}
        error={error}
        liveCount={liveCount}
        cachedCount={cachedCount}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
        onOpenSettings={() => setSettingsOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className="app-body">
        <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <VesselList
            vessels={vessels}
            selectedVessel={selectedVessel}
            onSelectVessel={handleSelectVessel}
            myBoatMmsi={settings.myBoatMmsi}
            apiKey={settings.apiKey}
            fleets={fleets}
            onAddToFleet={addToFleet}
            onRemoveFromFleet={removeFromFleet}
            onAddFleet={addFleet}
            onDeleteFleet={deleteFleet}
            onRenameFleet={renameFleet}
            onSetFleetColor={setFleetColor}
            onZoomToFleet={handleZoomToFleet}
            isTracked={isTracked}
            activeFleetId={activeFleetId}
            onSetActiveFleet={setActiveFleetId}
          />
        </div>

        <div className="map-container">
          <BoatMap
            vessels={vessels}
            selectedVessel={selectedVessel}
            onSelectVessel={handleSelectVessel}
            onBoundsChange={handleBoundsChange}
            showNames={settings.showNames}
            myBoatMmsi={settings.myBoatMmsi}
            fitBounds={fitBounds}
            onFitBoundsConsumed={handleFitBoundsConsumed}
            vesselFleetColors={vesselFleetColors}
            trailPoints={trailPoints}
            trailColor={trailColor}
            theme={theme}
          />
        </div>

        {selectedVessel && (
          <VesselPanel
            vessel={selectedVessel}
            onClose={() => setSelectedVessel(null)}
            fleets={fleets}
            isTracked={isTracked(selectedVessel.mmsi)}
            onAddToFleet={addToFleet}
            onRemoveFromFleet={removeFromFleet}
          />
        )}
      </div>

      {settingsOpen && (
        <SettingsModal
          apiKey={settings.apiKey}
          showNames={settings.showNames}
          myBoatMmsi={settings.myBoatMmsi}
          onSave={(s) => updateSettings(s)}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
