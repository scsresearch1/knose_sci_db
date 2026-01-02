import { useState, useEffect } from 'react'
import { subscribeToDevices, DeviceData } from '../services/deviceService'
import './DeviceStatus.css'

interface DeviceStatusProps {
  deviceId: string
  onViewData?: () => void
}

const DeviceStatus = ({ deviceId, onViewData }: DeviceStatusProps) => {
  const [devices, setDevices] = useState<DeviceData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)

    const unsubscribe = subscribeToDevices(
      (fetchedDevices) => {
        setDevices(fetchedDevices)
        setIsLoading(false)
      },
      (error) => {
        console.error('Error loading devices:', error)
        setIsLoading(false)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return '#00ff88'
      case 'warning':
        return '#ffb800'
      case 'offline':
        return '#ff4444'
      default:
        return '#7dd3fc'
    }
  }

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  if (isLoading) {
    return (
      <div className="device-status-loading">
        <p>Loading device status...</p>
      </div>
    )
  }

  // Filter to show only the current device or all devices
  const displayDevices = devices.filter(d => d.id === deviceId)

  return (
    <div className="device-status">
      <div className="device-grid">
        {displayDevices.map((device) => (
          <div key={device.id} className="device-card">
            <div className="device-header">
              <div className="device-info">
                <span className="device-id">{device.id}</span>
                <h3 className="device-name">{device.name}</h3>
              </div>
              <div
                className="device-status-indicator"
                style={{ color: getStatusColor(device.status) }}
              >
                <span className="status-dot" style={{ backgroundColor: getStatusColor(device.status) }}></span>
                {getStatusLabel(device.status)}
              </div>
            </div>

            <div className="device-details">
              <div className="detail-row">
                <span className="detail-label">Location:</span>
                <span className="detail-value">{device.location}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Sensors:</span>
                <span className="detail-value">{device.sensorCount} active</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Last Update:</span>
                <span className="detail-value">{device.lastUpdate}</span>
              </div>
            </div>

            <div className="device-actions">
              <button className="action-button" onClick={onViewData}>View Data</button>
              <button className="action-button">Configure</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default DeviceStatus

