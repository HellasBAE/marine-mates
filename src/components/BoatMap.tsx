import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, LayersControl, Polyline, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { Vessel, MapBounds } from '../types'
import { getShipTypeColor } from '../api'
import { VesselMarker } from './VesselMarker'

import 'leaflet/dist/leaflet.css'

interface BoatMapProps {
  vessels: Vessel[]
  selectedVessel: Vessel | null
  onSelectVessel: (vessel: Vessel | null) => void
  onBoundsChange: (bounds: MapBounds) => void
  showNames: boolean
  myBoatMmsi: string
  fitBounds?: MapBounds | null
  onFitBoundsConsumed?: () => void
  vesselFleetColors?: Map<number, string>
  trailPoints?: [number, number][]
  trailColor?: string
}

// Fix Leaflet default icon issue
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Default center on Staniel Cay, Bahamas
const DEFAULT_CENTER: [number, number] = [24.17, -76.44]
const DEFAULT_ZOOM = 10

function MapEvents({ onBoundsChange }: { onBoundsChange: (bounds: MapBounds) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const b = map.getBounds()
      onBoundsChange({
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      })
    },
    zoomend: () => {
      const b = map.getBounds()
      onBoundsChange({
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      })
    },
  })

  // Fire initial bounds
  useEffect(() => {
    const b = map.getBounds()
    onBoundsChange({
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    })
  }, [map, onBoundsChange])

  return null
}

function FlyToVessel({ vessel }: { vessel: Vessel | null }) {
  const map = useMap()
  useEffect(() => {
    if (vessel) {
      map.flyTo([vessel.lat, vessel.lng], Math.max(map.getZoom(), 10), {
        duration: 1,
      })
    }
  }, [vessel, map])
  return null
}

function FitBoundsControl({ bounds, onConsumed }: { bounds: MapBounds | null | undefined; onConsumed?: () => void }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) {
      map.flyToBounds(
        [[bounds.south, bounds.west], [bounds.north, bounds.east]],
        { padding: [40, 40], duration: 1.2 }
      )
      onConsumed?.()
    }
  }, [bounds, map, onConsumed])
  return null
}

// Auto-center on myBoat when it first appears (~1 mile radius = zoom 15)
function AutoCenterMyBoat({ vessels, myBoatMmsi }: { vessels: Vessel[]; myBoatMmsi: string }) {
  const map = useMap()
  const hasCentered = useRef(false)
  const myMmsi = myBoatMmsi ? parseInt(myBoatMmsi, 10) : null

  useEffect(() => {
    if (hasCentered.current || !myMmsi) return
    const myBoat = vessels.find((v) => v.mmsi === myMmsi)
    if (myBoat) {
      hasCentered.current = true
      map.flyTo([myBoat.lat, myBoat.lng], 15, { duration: 1.5 })
    }
  }, [vessels, myMmsi, map])

  return null
}

function FindMyBoatControl({ vessels, myBoatMmsi, onSelectVessel }: {
  vessels: Vessel[]
  myBoatMmsi: string
  onSelectVessel: (vessel: Vessel) => void
}) {
  const map = useMap()
  const myMmsi = myBoatMmsi ? parseInt(myBoatMmsi, 10) : null

  if (!myMmsi) return null

  const handleClick = () => {
    const myBoat = vessels.find(v => v.mmsi === myMmsi)
    if (myBoat) {
      map.flyTo([myBoat.lat, myBoat.lng], Math.max(map.getZoom(), 14), { duration: 1.5 })
      onSelectVessel(myBoat)
    }
  }

  return (
    <div className="find-my-boat-control">
      <button className="find-my-boat-btn" onClick={handleClick} title="Find My Boat">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="3"/>
          <line x1="12" y1="2" x2="12" y2="6"/>
          <line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="6" y2="12"/>
          <line x1="18" y1="12" x2="22" y2="12"/>
        </svg>
      </button>
    </div>
  )
}

export function BoatMap({
  vessels,
  selectedVessel,
  onSelectVessel,
  onBoundsChange,
  showNames,
  myBoatMmsi,
  fitBounds,
  onFitBoundsConsumed,
  vesselFleetColors,
  trailPoints,
  trailColor,
}: BoatMapProps) {
  const myMmsi = myBoatMmsi ? parseInt(myBoatMmsi, 10) : null

  const markers = useMemo(
    () =>
      vessels.map((vessel) => (
        <VesselMarker
          key={vessel.mmsi}
          vessel={vessel}
          isSelected={selectedVessel?.mmsi === vessel.mmsi}
          isMyBoat={vessel.mmsi === myMmsi}
          isTracked={vesselFleetColors?.has(vessel.mmsi)}
          onClick={() => onSelectVessel(vessel)}
          showName={showNames}
          color={vesselFleetColors?.get(vessel.mmsi) || getShipTypeColor(vessel.shipType)}
          isCached={vessel.isCached}
        />
      )),
    [vessels, selectedVessel, onSelectVessel, showNames, myMmsi]
  )

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      className="boat-map"
      zoomControl={false}
    >
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Dark">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satellite">
          <TileLayer
            attribution='&copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Nautical">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Light">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
        </LayersControl.BaseLayer>
      </LayersControl>
      <MapEvents onBoundsChange={onBoundsChange} />
      <FlyToVessel vessel={selectedVessel} />
      <FitBoundsControl bounds={fitBounds} onConsumed={onFitBoundsConsumed} />
      <AutoCenterMyBoat vessels={vessels} myBoatMmsi={myBoatMmsi} />
      <FindMyBoatControl vessels={vessels} myBoatMmsi={myBoatMmsi} onSelectVessel={onSelectVessel} />
      {trailPoints && trailPoints.length > 1 && (
        <Polyline
          positions={trailPoints}
          pathOptions={{ color: trailColor || '#1e88e5', weight: 3, opacity: 0.7, dashArray: '8 4' }}
        />
      )}
      {markers}
    </MapContainer>
  )
}
