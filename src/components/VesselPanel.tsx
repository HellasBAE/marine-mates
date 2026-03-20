import type { Vessel, Fleet } from '../types'
import { getShipTypeColor } from '../api'

interface VesselPanelProps {
  vessel: Vessel
  onClose: () => void
  fleets: Fleet[]
  isTracked: boolean
  onAddToFleet: (fleetId: string, mmsi: number) => void
  onRemoveFromFleet: (fleetId: string, mmsi: number) => void
}

function formatSpeed(speed: number): string {
  return `${speed.toFixed(1)} kn`
}

function formatCourse(course: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const index = Math.round(course / 45) % 8
  return `${course.toFixed(0)}° ${dirs[index]}`
}

function formatTime(iso: string): string {
  try {
    const date = new Date(iso)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return iso
  }
}

export function VesselPanel({ vessel, onClose, fleets, isTracked, onAddToFleet, onRemoveFromFleet }: VesselPanelProps) {
  const typeColor = getShipTypeColor(vessel.shipType)

  // Find which fleets this vessel is in
  const inFleets = fleets.filter((f) => f.mmsiList.includes(vessel.mmsi))

  return (
    <div className="vessel-panel">
      <div className="vessel-panel-header">
        <div className="vessel-panel-title">
          <div className="vessel-type-badge" style={{ backgroundColor: typeColor }}>
            {vessel.shipType}
          </div>
          <h2>{vessel.name}</h2>
          {vessel.flag && <span className="vessel-flag">{vessel.flag}</span>}
        </div>
        <button className="close-btn" onClick={onClose} aria-label="Close panel">
          ×
        </button>
      </div>

      {/* Track / Untrack actions */}
      <div className="vessel-panel-actions">
        {isTracked ? (
          inFleets.map((f) => (
            <button
              key={f.id}
              className="panel-action-btn panel-untrack-btn"
              onClick={() => onRemoveFromFleet(f.id, vessel.mmsi)}
            >
              ✕ Remove from {f.name}
            </button>
          ))
        ) : (
          fleets.map((f) => (
            <button
              key={f.id}
              className="panel-action-btn panel-track-btn"
              onClick={() => onAddToFleet(f.id, vessel.mmsi)}
            >
              + Add to {f.name}
            </button>
          ))
        )}
      </div>

      <div className="vessel-panel-body">
        <div className="vessel-info-grid">
          <InfoRow label="MMSI" value={String(vessel.mmsi)} />
          {vessel.imo > 0 && <InfoRow label="IMO" value={String(vessel.imo)} />}
          {vessel.callsign && <InfoRow label="Callsign" value={vessel.callsign} />}
          <InfoRow label="Status" value={vessel.status} />
          <InfoRow label="Speed" value={formatSpeed(vessel.speed)} />
          <InfoRow label="Course" value={formatCourse(vessel.course)} />
          <InfoRow label="Heading" value={`${vessel.heading}°`} />
          {vessel.destination && <InfoRow label="Destination" value={vessel.destination} />}
          {vessel.length > 0 && (
            <InfoRow label="Size" value={`${vessel.length}m × ${vessel.width}m`} />
          )}
          <InfoRow
            label="Position"
            value={`${vessel.lat.toFixed(4)}°, ${vessel.lng.toFixed(4)}°`}
          />
          <InfoRow label="Last Update" value={formatTime(vessel.lastUpdate)} />
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{value}</span>
    </div>
  )
}
