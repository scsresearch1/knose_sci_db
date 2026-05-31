import { DeviceData } from '../services/deviceService'
import './DeviceStatus.css'

interface DeviceStatusProps {
  device: DeviceData
  onViewData?: () => void
}

const DeviceStatus = ({ device, onViewData }: DeviceStatusProps) => {
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

  return (
    <div className="device-status">
      <div className="device-grid">
        <div className="device-card">
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
              <span className="detail-label">Sensors:</span>
              <span className="detail-value">{device.sensorCount} active</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Last Update:</span>
              <span className="detail-value">{device.lastUpdateTimestamp || device.lastUpdate || 'Never'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Data Points:</span>
              <span className="detail-value">{device.dataPoints?.toLocaleString() ?? '0'}</span>
            </div>
          </div>

          <div className="device-actions">
            <button className="action-button" onClick={onViewData}>View Data</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeviceStatus
