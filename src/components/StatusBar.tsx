interface StatusBarProps {
  vesselCount: number
  isLive: boolean
  loading: boolean
  error: string | null
  liveCount: number
  cachedCount: number
  onToggleSidebar: () => void
  sidebarOpen: boolean
  onOpenSettings: () => void
}

export function StatusBar({
  vesselCount,
  isLive,
  loading,
  error,
  liveCount,
  cachedCount,
  onToggleSidebar,
  sidebarOpen,
  onOpenSettings,
}: StatusBarProps) {
  const renderStatus = () => {
    if (error) {
      return <span className="status-error">{error}</span>
    }

    if (loading && vesselCount === 0) {
      return <span className="status-loading">Loading vessels...</span>
    }

    if (isLive) {
      // Still receiving — show live counter ticking up
      if (cachedCount > 0 && liveCount < vesselCount) {
        return (
          <span className="status-info">
            <span className="status-streaming">Receiving AIS</span>
            {' · '}
            <span className="status-live-count">{liveCount}</span> live
            {' · '}
            {vesselCount} total
          </span>
        )
      }
      return (
        <span className="status-info">
          {vesselCount} vessel{vesselCount !== 1 ? 's' : ''}
        </span>
      )
    }

    return (
      <span className="status-info">
        {vesselCount} vessel{vesselCount !== 1 ? 's' : ''} (demo)
      </span>
    )
  }

  return (
    <div className="status-bar">
      <div className="status-left">
        <button className="hamburger-btn" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          {sidebarOpen ? '✕' : '☰'}
        </button>
        <span className="app-title">Boat Tracker</span>
      </div>

      <div className="status-center">
        {renderStatus()}
      </div>

      <div className="status-right">
        <span className={`live-indicator ${isLive ? 'live' : 'demo'}`}>
          <span className="live-dot" />
          {isLive ? 'LIVE' : 'DEMO'}
        </span>
        <button className="settings-btn" onClick={onOpenSettings} aria-label="Settings">
          ⚙
        </button>
      </div>
    </div>
  )
}
