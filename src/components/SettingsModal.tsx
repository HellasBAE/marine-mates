import { useState } from 'react'

interface SettingsModalProps {
  apiKey: string
  showNames: boolean
  myBoatMmsi: string
  onSave: (settings: { apiKey: string; showNames: boolean; myBoatMmsi: string }) => void
  onClose: () => void
}

export function SettingsModal({ apiKey, showNames, myBoatMmsi, onSave, onClose }: SettingsModalProps) {
  const [key, setKey] = useState(apiKey)
  const [names, setNames] = useState(showNames)
  const [mmsi, setMmsi] = useState(myBoatMmsi)

  const handleSave = () => {
    onSave({ apiKey: key, showNames: names, myBoatMmsi: mmsi })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="setting-group">
            <label htmlFor="api-key">AISStream API Key</label>
            <input
              id="api-key"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Enter your aisstream.io API key"
              className="setting-input"
            />
            <p className="setting-hint">
              Get a free API key at{' '}
              <a href="https://aisstream.io" target="_blank" rel="noopener noreferrer">
                aisstream.io
              </a>{' '}
              for live vessel data. Without a key, demo data is shown.
            </p>
          </div>

          <div className="setting-group">
            <label htmlFor="my-boat-mmsi">My Boat MMSI</label>
            <input
              id="my-boat-mmsi"
              type="text"
              value={mmsi}
              onChange={(e) => setMmsi(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 368398110"
              className="setting-input"
            />
            <p className="setting-hint">
              Enter your vessel's MMSI to highlight it on the map and enable "Find My Boat".
            </p>
          </div>

          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={names}
                onChange={(e) => setNames(e.target.checked)}
              />
              Show vessel names on map
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
