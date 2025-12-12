import { useState, useEffect } from 'react'
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

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    setIsLoading(true)
    setError(null)

    // Subscribe to Firebase real-time updates
    const unsubscribe = subscribeToDevices(
      (fetchedDevices) => {
        setDevices(fetchedDevices)
        setIsLoading(false)
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

    return () => {
      unsubscribe()
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
          <div className="loading-spinner"></div>
          <p>Loading devices...</p>
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
            <h2 className="error-title">Firebase Connection Error</h2>
            <p className="error-message">{error}</p>
            {error.includes('permission') && (
              <div className="error-instructions">
                <p className="instructions-title">To fix this issue:</p>
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
                <p className="instructions-note">⚠️ Note: This allows public read access. For production, implement proper authentication.</p>
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
        <div className="devices-header">
          <h1 className="devices-title">Device Inventory</h1>
          <p className="devices-subtitle">Select a device to view detailed sensor data and analytics</p>
        </div>

        {devices.length === 0 ? (
          <div className="no-devices">
            <p>No devices found. Please check your Firebase connection.</p>
          </div>
        ) : (
          <div className="devices-grid">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onClick={() => handleDeviceClick(device.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DevicesList
