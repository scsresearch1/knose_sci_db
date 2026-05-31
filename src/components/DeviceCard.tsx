import './DeviceCard.css'
import { DeviceData } from '../services/deviceService'

interface Device extends DeviceData {
  uptime?: number
}

interface DeviceCardProps {
  device: Device
  onClick: () => void
}

const STATUS_LABELS: Record<Device['status'], string> = {
  online: 'Online',
  warning: 'Degraded',
  offline: 'Offline',
}

const DeviceCard = ({ device, onClick }: DeviceCardProps) => {
  const formatNumber = (num: number | undefined, decimals = 3): string => {
    if (num === undefined || Number.isNaN(num)) return '—'
    return num.toFixed(decimals)
  }

  const sensorCount = device.sensorCount || device.sensors?.length || 0

  return (
    <article
      className={`device-card device-card--${device.status}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <div className="device-card-header">
        <div className="device-card-identity">
          <span className="device-card-label">Instrument Unit</span>
          <h3 className="device-card-name">{device.name}</h3>
          <span className="device-card-id">{device.id.replace('_', ' ')}</span>
        </div>
        <div className={`device-card-status device-card-status--${device.status}`}>
          <span className="device-card-status-dot" aria-hidden="true" />
          <span>{STATUS_LABELS[device.status]}</span>
        </div>
      </div>

      <div className="device-card-panel">
        <div className="device-card-panel-title">Live Readings</div>
        <dl className="device-card-readouts">
          <div className="readout-row">
            <dt className="readout-label">Temperature</dt>
            <dd className="readout-value">
              {formatNumber(device.temperature)}
              <span className="readout-unit">°C</span>
            </dd>
          </div>
          <div className="readout-row">
            <dt className="readout-label">Bus Voltage</dt>
            <dd className="readout-value">
              {formatNumber(device.voltage)}
              <span className="readout-unit">V</span>
            </dd>
          </div>
          <div className="readout-row">
            <dt className="readout-label">VCC Supply</dt>
            <dd className="readout-value">
              {formatNumber(device.vcc)}
              <span className="readout-unit">V</span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="device-card-footer">
        <div className="device-card-meta">
          <div className="meta-cell">
            <span className="meta-label">Sensor Channels</span>
            <span className="meta-value">{sensorCount > 0 ? sensorCount : '—'}</span>
          </div>
          <div className="meta-cell">
            <span className="meta-label">Last Acquisition</span>
            <span className="meta-value meta-value--timestamp">
              {device.lastUpdateTimestamp || device.lastUpdate || 'No data'}
            </span>
          </div>
        </div>
        <div className="device-card-action">
          <span>Open Instrument Panel</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </article>
  )
}

export default DeviceCard
