import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import DeviceCard from '../components/DeviceCard'
import { subscribeToDevices, DeviceData } from '../services/deviceService'
import './DevicesList.css'

interface DevicesListProps {
  onLogout: () => void
}

const DevicesList = ({ onLogout }: DevicesListProps) => {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [devices, setDevices] = useState<DeviceData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const statusSummary = useMemo(() => {
    return devices.reduce(
      (acc, device) => {
        acc[device.status] += 1
        return acc
      },
      { online: 0, warning: 0, offline: 0 }
    )
  }, [devices])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    setIsLoading(true)
    setError(null)

    let loadingTimeout: ReturnType<typeof setTimeout> | null = null

    const unsubscribe = subscribeToDevices(
      (fetchedDevices) => {
        setDevices(fetchedDevices)
        if (fetchedDevices.length > 0) {
          setIsLoading(false)
        }
      },
      (err: Error) => {
        console.error('Error fetching devices:', err)
        if ((err as { code?: string; message?: string })?.code === 'PERMISSION_DENIED' || err?.message?.includes('permission_denied')) {
          setError('Firebase permission denied. Please update your database security rules to allow read access.')
        } else {
          setError('Failed to load devices. Please check your Firebase connection and security rules.')
        }
        setIsLoading(false)
      }
    )

    loadingTimeout = setTimeout(() => setIsLoading(false), 15000)

    return () => {
      unsubscribe()
      if (loadingTimeout) clearTimeout(loadingTimeout)
    }
  }, [])

  const handleDeviceClick = (deviceId: string) => {
    navigate(`/dashboard/${deviceId}`)
  }

  if (isLoading) {
    return (
      <div className="devices-list-page">
        <Header currentTime={currentTime} onLogout={onLogout} />
        <div className="loading-container">
          <div className="loading-spinner" role="status" aria-label="Loading" />
          <p className="loading-text">Initializing instrument registry…</p>
          <span className="loading-subtext">Querying Firebase Realtime Database</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="devices-list-page">
        <Header currentTime={currentTime} onLogout={onLogout} />
        <div className="error-container">
          <div className="error-content">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <h2 className="error-title">Connection Error</h2>
            <p className="error-message">{error}</p>
            {error.includes('permission') && (
              <div className="error-instructions">
                <p className="instructions-title">Resolution Steps</p>
                <ol className="instructions-list">
                  <li>Go to Firebase Console: <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer">https://console.firebase.google.com/</a></li>
                  <li>Select your project: <strong>knose-e1959</strong></li>
                  <li>Navigate to <strong>Realtime Database</strong> → <strong>Rules</strong></li>
                  <li>Update the rules to allow read access:</li>
                </ol>
                <pre className="firebase-rules-code">
{`{
  "rules": {
    ".read": true,
    ".write": false
  }
}`}
                </pre>
                <p className="instructions-note">Note: Public read access is suitable for development only. Implement authentication for production deployments.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="devices-list-page">
      <Header currentTime={currentTime} onLogout={onLogout} />

      <div className="devices-content">
        <header className="inventory-banner">
          <div className="inventory-banner-main">
            <div className="inventory-banner-text">
              <span className="inventory-eyebrow">Knose Scientific Instrumentation Network</span>
              <h1 className="inventory-title">Device Inventory</h1>
              <p className="inventory-subtitle">
                Registered BME690 sensor arrays — select an instrument to access live telemetry, time-series analytics, and data export.
              </p>
            </div>
            <div className="inventory-doc-meta">
              <span className="doc-meta-label">Document ID</span>
              <span className="doc-meta-value">KNOSE-INV-001</span>
              <span className="doc-meta-label">Classification</span>
              <span className="doc-meta-value">Internal Use</span>
            </div>
          </div>

          {devices.length > 0 && (
            <div className="inventory-summary" role="status" aria-live="polite">
              <div className="summary-stat">
                <span className="summary-stat-label">Total Instruments</span>
                <span className="summary-stat-value">{devices.length}</span>
              </div>
              <div className="summary-divider" aria-hidden="true" />
              <div className="summary-stat summary-stat--online">
                <span className="summary-stat-label">Online</span>
                <span className="summary-stat-value">{statusSummary.online}</span>
              </div>
              <div className="summary-stat summary-stat--warning">
                <span className="summary-stat-label">Degraded</span>
                <span className="summary-stat-value">{statusSummary.warning}</span>
              </div>
              <div className="summary-stat summary-stat--offline">
                <span className="summary-stat-label">Offline</span>
                <span className="summary-stat-value">{statusSummary.offline}</span>
              </div>
            </div>
          )}
        </header>

        {devices.length === 0 ? (
          <div className="no-devices">
            <div className="no-devices-icon" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="4" y="8" width="32" height="24" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <path d="M4 14h32" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="8" cy="11" r="1" fill="currentColor" />
                <circle cx="12" cy="11" r="1" fill="currentColor" />
              </svg>
            </div>
            <p className="no-devices-title">No instruments registered</p>
            <p className="no-devices-text">
              Devices will appear automatically when data is published to the Firebase Realtime Database.
            </p>
            <p className="no-devices-hint">Expected node format: Device_1, Device_2, … with BME sensor channels</p>
          </div>
        ) : (
          <section className="inventory-section" aria-label="Instrument list">
            <div className="inventory-section-header">
              <h2 className="inventory-section-title">Registered Instruments</h2>
              <span className="inventory-section-count">{devices.length} units</span>
            </div>
            <div className="devices-grid">
              {devices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onClick={() => handleDeviceClick(device.id)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

export default DevicesList
