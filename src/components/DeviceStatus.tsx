import { DeviceData } from '../services/deviceService'
import './DeviceStatus.css'

interface DeviceStatusProps {
  device: DeviceData
  onViewData?: () => void
}

const STATUS_LABELS: Record<DeviceData['status'], string> = {
  online: 'Online',
  warning: 'Degraded',
  offline: 'Offline',
}

const DeviceStatus = ({ device, onViewData }: DeviceStatusProps) => {
  return (
    <div className="device-status">
      <div className="device-grid">
        <div className="device-card">
          <div className="device-header">
            <div className="device-info">
              <span className="device-id">{device.id.replace('_', ' ')}</span>
              <h3 className="device-name">{device.name}</h3>
            </div>
            <div className={`device-status-indicator device-status-indicator--${device.status}`}>
              <span className="status-dot" style={{ backgroundColor: 'currentColor' }} />
              {STATUS_LABELS[device.status]}
            </div>
          </div>

          <div className="device-details">
            <div className="detail-row">
              <span className="detail-label">Sensor Channels</span>
              <span className="detail-value">{device.sensorCount} active</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Last Acquisition</span>
              <span className="detail-value">{device.lastUpdateTimestamp || device.lastUpdate || 'No data'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Total Data Points</span>
              <span className="detail-value">{device.dataPoints?.toLocaleString() ?? '0'}</span>
            </div>
          </div>

          <div className="device-actions">
            <button className="action-button" onClick={onViewData}>View Raw Data Table</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeviceStatus
