import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import type { Vessel, Fleet } from '../types'
import { getShipTypeColor, searchCachedVessels, searchWorldwide } from '../api'

interface VesselListProps {
  vessels: Vessel[]
  selectedVessel: Vessel | null
  onSelectVessel: (vessel: Vessel) => void
  myBoatMmsi: string
  apiKey: string
  fleets: Fleet[]
  onAddToFleet: (fleetId: string, mmsi: number) => void
  onRemoveFromFleet: (fleetId: string, mmsi: number) => void
  onAddFleet: (name: string) => void
  onDeleteFleet: (fleetId: string) => void
  onRenameFleet: (fleetId: string, name: string) => void
  onZoomToFleet: (fleet: Fleet) => void
  isTracked: (mmsi: number) => boolean
}

type SidebarTab = 'fleets' | 'search'

// Haversine distance in nautical miles
function distanceNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3440.065 // Earth radius in NM
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function formatDistance(nm: number): string {
  if (nm < 0.1) return '< 0.1 nm'
  if (nm < 10) return `${nm.toFixed(1)} nm`
  return `${Math.round(nm)} nm`
}

export function VesselList({
  vessels,
  selectedVessel,
  onSelectVessel,
  myBoatMmsi,
  apiKey,
  fleets,
  onAddToFleet,
  onRemoveFromFleet,
  onAddFleet,
  onDeleteFleet,
  onRenameFleet,
  onZoomToFleet,
  isTracked,
}: VesselListProps) {
  const [tab, setTab] = useState<SidebarTab>('fleets')
  const [search, setSearch] = useState('')
  const [expandedFleet, setExpandedFleet] = useState<string | null>('default')
  const [creatingFleet, setCreatingFleet] = useState(false)
  const [newFleetName, setNewFleetName] = useState('')
  const [editingFleetId, setEditingFleetId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [hoveredMmsi, setHoveredMmsi] = useState<number | null>(null)
  const [trackMenuMmsi, setTrackMenuMmsi] = useState<number | null>(null)

  const myMmsi = myBoatMmsi ? parseInt(myBoatMmsi, 10) : null
  const myBoat = useMemo(() => (myMmsi ? vessels.find((v) => v.mmsi === myMmsi) : null), [vessels, myMmsi])

  const vesselMap = useMemo(() => {
    const map = new Map<number, Vessel>()
    vessels.forEach((v) => map.set(v.mmsi, v))
    return map
  }, [vessels])

  // Backend cache results
  const [dbResults, setDbResults] = useState<Vessel[]>([])
  // Worldwide AIS search results
  const [worldResults, setWorldResults] = useState<Vessel[]>([])
  const [searchStatus, setSearchStatus] = useState('')
  const [searching, setSearching] = useState(false)
  const worldCleanupRef = useRef<(() => void) | null>(null)

  // Cleanup worldwide search on unmount
  useEffect(() => () => { worldCleanupRef.current?.() }, [])

  const startSearch = useCallback((query: string) => {
    // Stop any previous worldwide search
    worldCleanupRef.current?.()
    worldCleanupRef.current = null
    setWorldResults([])
    setDbResults([])
    setSearchStatus('')

    if (!query.trim() || query.trim().length < 2) {
      setSearching(false)
      return
    }

    setSearching(true)

    // 1. Search backend cache
    searchCachedVessels(query.trim()).then((results) => {
      setDbResults(results)
    })

    // 2. Start worldwide AIS scan
    if (apiKey) {
      if (import.meta.env.DEV) {
        // Dev: use WebSocket-based worldwide search
        worldCleanupRef.current = searchWorldwide(
          apiKey,
          query.trim(),
          (vessel) => {
            setWorldResults((prev) => {
              if (prev.some((v) => v.mmsi === vessel.mmsi)) return prev
              return [...prev, vessel]
            })
          },
          (status) => {
            setSearchStatus(status)
            if (!status.includes('Scanning') && !status.includes('Connecting')) {
              setSearching(false)
            }
          },
          30000,
        )
      } else {
        // Production: poll serverless function with worldwide bounds
        setSearchStatus('Scanning worldwide AIS...')
        const params = new URLSearchParams({
          south: '-90', north: '90', west: '-180', east: '180',
          duration: '8',
          apiKey,
        })
        fetch(`/api/ais?${params}`)
          .then((r) => r.json())
          .then((data: Vessel[]) => {
            const q = query.trim().toLowerCase()
            const matches = data.filter((v: Vessel) =>
              v.name.toLowerCase().includes(q) ||
              v.callsign.toLowerCase().includes(q) ||
              String(v.mmsi).includes(q)
            )
            setWorldResults(matches)
            setSearchStatus(matches.length > 0 ? `${matches.length} result${matches.length > 1 ? 's' : ''}` : 'No matches found')
            setSearching(false)
          })
          .catch(() => {
            setSearchStatus('Search failed')
            setSearching(false)
          })
      }
    } else {
      setSearching(false)
    }
  }, [apiKey])

  // Debounce search input
  useEffect(() => {
    if (tab !== 'search') return
    const timer = setTimeout(() => startSearch(search), 500)
    return () => clearTimeout(timer)
  }, [search, tab, startSearch])

  // Stop worldwide search when leaving search tab
  useEffect(() => {
    if (tab !== 'search') {
      worldCleanupRef.current?.()
      worldCleanupRef.current = null
    }
  }, [tab])

  // Merge live + cached + worldwide search results
  const searchResults = useMemo(() => {
    if (!search.trim()) return []
    const query = search.toLowerCase().trim()

    // Start with live in-memory matches
    const merged = new Map<number, Vessel>()
    for (const v of vessels) {
      if (
        v.name.toLowerCase().includes(query) ||
        v.callsign.toLowerCase().includes(query) ||
        String(v.mmsi).includes(query) ||
        v.destination.toLowerCase().includes(query)
      ) {
        merged.set(v.mmsi, v)
      }
    }

    // Add worldwide AIS results (these are live, not cached)
    for (const v of worldResults) {
      if (!merged.has(v.mmsi)) {
        merged.set(v.mmsi, v)
      }
    }

    // Add DB cache results (lowest priority)
    for (const v of dbResults) {
      if (!merged.has(v.mmsi)) {
        merged.set(v.mmsi, { ...v, isCached: true })
      }
    }

    return Array.from(merged.values())
      .map((v) => ({
        vessel: v,
        distance: myBoat ? distanceNm(myBoat.lat, myBoat.lng, v.lat, v.lng) : null,
      }))
      .sort((a, b) => {
        if (a.vessel.mmsi === myMmsi) return -1
        if (b.vessel.mmsi === myMmsi) return 1
        if (a.distance != null && b.distance != null) return a.distance - b.distance
        return a.vessel.name.localeCompare(b.vessel.name)
      })
  }, [vessels, search, worldResults, dbResults, myBoat, myMmsi])

  const handleCreateFleet = () => {
    if (newFleetName.trim()) {
      onAddFleet(newFleetName.trim())
      setNewFleetName('')
      setCreatingFleet(false)
    }
  }

  const handleRename = (fleetId: string) => {
    if (editName.trim()) {
      onRenameFleet(fleetId, editName.trim())
    }
    setEditingFleetId(null)
  }

  const handleTrack = (mmsi: number, fleetId: string) => {
    onAddToFleet(fleetId, mmsi)
    setTrackMenuMmsi(null)
  }

  const formatTimeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const secs = Math.floor(diff / 1000)
    if (secs < 60) return `${secs}s ago`
    const mins = Math.floor(secs / 60)
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins / 60)}h ago`
  }

  const renderVesselItem = (vessel: Vessel, opts?: { fleetId?: string; distance?: number | null }) => {
    const fleetId = opts?.fleetId
    const distance = opts?.distance ?? null
    const isMyBoat = vessel.mmsi === myMmsi
    const isSelected = selectedVessel?.mmsi === vessel.mmsi
    const isHovered = hoveredMmsi === vessel.mmsi
    const showTrackMenu = trackMenuMmsi === vessel.mmsi
    const tracked = isTracked(vessel.mmsi)

    return (
      <div
        key={`${fleetId ?? 'search'}-${vessel.mmsi}`}
        className={`vessel-card ${isSelected ? 'selected' : ''} ${isMyBoat ? 'my-boat-card' : ''} ${isHovered ? 'hovered' : ''}`}
        onClick={() => onSelectVessel(vessel)}
        onMouseEnter={() => setHoveredMmsi(vessel.mmsi)}
        onMouseLeave={() => {
          setHoveredMmsi(null)
          setTrackMenuMmsi(null)
        }}
      >
        <div className="vessel-card-main">
          <div
            className="vessel-card-indicator"
            style={{ backgroundColor: isMyBoat ? '#FFD700' : getShipTypeColor(vessel.shipType) }}
          />
          <div className="vessel-card-info">
            <div className="vessel-card-top">
              <span className="vessel-card-name">
                {vessel.name}
                {isMyBoat && <span className="my-boat-tag">MY BOAT</span>}
                {tracked && !fleetId && <span className="tracked-tag">TRACKED</span>}
              </span>
              <span className="vessel-card-speed">{vessel.speed.toFixed(1)} kn</span>
            </div>
            <div className="vessel-card-bottom">
              <span className="vessel-card-type">{vessel.shipType}</span>
              {distance != null && (
                <span className="vessel-card-distance">{formatDistance(distance)}</span>
              )}
              {vessel.destination && (
                <span className="vessel-card-dest">
                  <span className="dest-arrow">→</span> {vessel.destination}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Expanded hover details */}
        {isHovered && (
          <div className="vessel-card-expand">
            <div className="vessel-card-details">
              <div className="detail-chip">{vessel.status}</div>
              <div className="detail-chip">HDG {vessel.heading}°</div>
              <div className="detail-chip">{formatTimeAgo(vessel.lastUpdate)}</div>
              {vessel.flag && <div className="detail-chip">{vessel.flag}</div>}
              {vessel.callsign && <div className="detail-chip">{vessel.callsign}</div>}
            </div>
            <div className="vessel-card-actions">
              {fleetId ? (
                <button
                  className="action-btn remove-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveFromFleet(fleetId, vessel.mmsi)
                  }}
                  title="Remove from fleet"
                >
                  ✕
                </button>
              ) : !tracked ? (
                <div className="track-btn-wrapper">
                  <button
                    className="action-btn track-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (fleets.length === 1) {
                        handleTrack(vessel.mmsi, fleets[0].id)
                      } else {
                        setTrackMenuMmsi(showTrackMenu ? null : vessel.mmsi)
                      }
                    }}
                    title="Track this vessel"
                  >
                    + Track
                  </button>
                  {showTrackMenu && fleets.length > 1 && (
                    <div className="track-menu">
                      {fleets.map((f) => (
                        <button
                          key={f.id}
                          className="track-menu-item"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleTrack(vessel.mmsi, f.id)
                          }}
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="vessel-list">
      {/* Tab bar */}
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${tab === 'fleets' ? 'active' : ''}`}
          onClick={() => setTab('fleets')}
        >
          Fleets
          <span className="tab-count">
            {fleets.reduce((n, f) => n + f.mmsiList.length, 0)}
          </span>
        </button>
        <button
          className={`sidebar-tab ${tab === 'search' ? 'active' : ''}`}
          onClick={() => setTab('search')}
        >
          Search
        </button>
      </div>

      {/* Fleets tab */}
      {tab === 'fleets' && (
        <div className="fleet-panel">
          {fleets.map((fleet) => {
            const isExpanded = expandedFleet === fleet.id
            const fleetVessels = fleet.mmsiList
              .map((mmsi) => vesselMap.get(mmsi))
              .filter(Boolean) as Vessel[]
            const offlineCount = fleet.mmsiList.length - fleetVessels.length

            return (
              <div key={fleet.id} className="fleet-group">
                <div
                  className="fleet-header"
                  onClick={() => setExpandedFleet(isExpanded ? null : fleet.id)}
                >
                  <div className="fleet-header-left">
                    <span className={`fleet-chevron ${isExpanded ? 'open' : ''}`}>›</span>
                    {editingFleetId === fleet.id ? (
                      <input
                        className="fleet-rename-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => handleRename(fleet.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(fleet.id)
                          if (e.key === 'Escape') setEditingFleetId(null)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="fleet-name"
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          setEditingFleetId(fleet.id)
                          setEditName(fleet.name)
                        }}
                      >
                        {fleet.name}
                      </span>
                    )}
                    <span className="fleet-count">
                      {fleetVessels.length}
                      {offlineCount > 0 && <span className="offline-count">+{offlineCount} offline</span>}
                    </span>
                  </div>
                  <div className="fleet-header-right">
                    {fleetVessels.length > 0 && (
                      <button
                        className="fleet-zoom-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          onZoomToFleet(fleet)
                        }}
                        title="Zoom to fleet"
                      >
                        ⊕
                      </button>
                    )}
                    {fleet.id !== 'default' && (
                      <button
                        className="fleet-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteFleet(fleet.id)
                        }}
                        title="Delete fleet"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="fleet-vessels">
                    {fleetVessels.length === 0 && fleet.mmsiList.length === 0 && (
                      <div className="fleet-empty">
                        No vessels tracked yet. Use Search to find and add boats.
                      </div>
                    )}
                    {fleetVessels.map((v) => {
                      const dist = myBoat ? distanceNm(myBoat.lat, myBoat.lng, v.lat, v.lng) : null
                      return renderVesselItem(v, { fleetId: fleet.id, distance: dist })
                    })}
                    {offlineCount > 0 && (
                      <div className="fleet-offline-note">
                        {offlineCount} vessel{offlineCount > 1 ? 's' : ''} not in range
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* New fleet button */}
          {creatingFleet ? (
            <div className="new-fleet-form">
              <input
                className="new-fleet-input"
                placeholder="Fleet name..."
                value={newFleetName}
                onChange={(e) => setNewFleetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFleet()
                  if (e.key === 'Escape') setCreatingFleet(false)
                }}
                autoFocus
              />
              <button className="btn btn-primary btn-sm" onClick={handleCreateFleet}>
                Create
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setCreatingFleet(false)}
              >
                ✕
              </button>
            </div>
          ) : (
            <button className="new-fleet-btn" onClick={() => setCreatingFleet(true)}>
              + New Fleet
            </button>
          )}
        </div>
      )}

      {/* Search tab */}
      {tab === 'search' && (
        <>
          <div className="vessel-list-header">
            <input
              type="text"
              placeholder="Search by name, callsign, MMSI, or destination..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="vessel-search"
              autoFocus
            />
            {search.trim() && (
              <div className="search-result-count">
                {searchStatus && <span className="search-status">{searchStatus}</span>}
                {!searchStatus && searching && 'Searching...'}
                {!searching && !searchStatus && searchResults.length > 0 && (
                  <>
                    {searchResults.length} vessel{searchResults.length !== 1 ? 's' : ''} found
                    {searchResults.length > 1 && myBoat && ' — sorted by distance'}
                  </>
                )}
              </div>
            )}
          </div>
          <div className="vessel-list-items">
            {!search.trim() && (
              <div className="search-prompt">
                Search for any vessel worldwide by name, callsign, or MMSI
              </div>
            )}
            {search.trim() && searchResults.length === 0 && (
              <div className="vessel-list-empty">
                No vessels match "{search}"
              </div>
            )}
            {searchResults.map((r) =>
              renderVesselItem(r.vessel, { distance: r.distance })
            )}
          </div>
        </>
      )}
    </div>
  )
}
