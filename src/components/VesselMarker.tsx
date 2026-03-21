import { Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import type { Vessel } from '../types'

interface VesselMarkerProps {
  vessel: Vessel
  isSelected: boolean
  isMyBoat: boolean
  isTracked?: boolean
  onClick: () => void
  showName: boolean
  color: string
  isCached?: boolean
}

function createBoatIcon(heading: number, color: string, isSelected: boolean, isMyBoat: boolean, isCached: boolean, isTracked: boolean): L.DivIcon {
  const effectiveColor = isMyBoat ? '#FFD700' : color
  // Tracked boats are bigger, cached are smaller
  let size: number
  if (isCached) {
    size = isSelected ? 22 : 16
  } else if (isMyBoat) {
    size = isSelected ? 36 : 30
  } else if (isTracked) {
    size = isSelected ? 36 : 28
  } else {
    size = isSelected ? 24 : 16
  }
  const opacity = isCached ? 0.35 : 1
  const borderColor = isSelected ? '#fff' : isMyBoat ? 'rgba(255,215,0,0.8)' : isCached ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.4)'
  const borderWidth = isSelected || isMyBoat ? 2 : 1
  const shadow = isSelected ? '0 0 12px rgba(255,255,255,0.5)' : isMyBoat ? '0 0 12px rgba(255,215,0,0.6)' : '0 2px 4px rgba(0,0,0,0.5)'
  const pulseClass = isMyBoat ? 'my-boat-pulse' : ''

  const svg = `
    <div class="${pulseClass}" style="opacity: ${opacity}">
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"
           style="transform: rotate(${heading}deg); filter: drop-shadow(${shadow});">
        <path d="M12 2 L18 18 L12 14 L6 18 Z"
              fill="${effectiveColor}" stroke="${borderColor}" stroke-width="${borderWidth}"
              stroke-linejoin="round"${isCached ? ' stroke-dasharray="2,2"' : ''}/>
      </svg>
    </div>
  `

  return L.divIcon({
    html: svg,
    className: 'vessel-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export function VesselMarker({ vessel, isSelected, isMyBoat, isTracked, onClick, showName, color, isCached }: VesselMarkerProps) {
  const icon = createBoatIcon(vessel.heading, color, isSelected, isMyBoat, !!isCached, !!isTracked)

  return (
    <Marker
      position={[vessel.lat, vessel.lng]}
      icon={icon}
      eventHandlers={{ click: onClick }}
      zIndexOffset={isMyBoat ? 1000 : isTracked ? 500 : isCached ? -100 : 0}
    >
      {(showName || isMyBoat || isTracked) && !isCached && (
        <Tooltip
          direction="top"
          offset={[0, -14]}
          permanent={isSelected || isMyBoat}
          className={`vessel-tooltip ${isMyBoat ? 'my-boat-tooltip' : ''}`}
        >
          <span>{vessel.name}</span>
        </Tooltip>
      )}
    </Marker>
  )
}
