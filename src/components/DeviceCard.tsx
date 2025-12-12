import './DeviceCard.css'
import { DeviceData } from '../services/deviceService'

interface Device extends DeviceData {
  uptime?: number
}

interface DeviceCardProps {
  device: Device
  onClick: () => void
}

const DeviceCard = ({ device, onClick }: DeviceCardProps) => {
  const getStatusColor = () => {
    switch (device.status) {
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

  const formatUptime = (seconds?: number): string => {
    if (seconds === undefined || seconds === null) return 'N/A'
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const formatNumber = (num: number, decimals: number = 3): string => {
    return num.toFixed(decimals)
  }

  return (
    <div className="device-card" onClick={onClick}>
      <div className="device-image-container">
        <div className="device-image-placeholder">
          <svg width="100%" height="100%" viewBox="0 0 400 300" fill="none">
            {/* Device base */}
            <rect x="50" y="150" width="300" height="120" rx="8" fill="#2a2a2a" stroke="#00ff88" strokeWidth="2"/>
            {/* Screen */}
            <rect x="120" y="170" width="160" height="60" rx="4" fill="#0a0e14" stroke="#00d4ff" strokeWidth="1"/>
            {/* Screen text */}
            <text x="130" y="195" fill="#00ff88" fontSize="12" fontFamily="monospace">Temperature: {device.temperature ? formatNumber(device.temperature) : 'N/A'}°C</text>
            <text x="130" y="210" fill="#00d4ff" fontSize="12" fontFamily="monospace">Voltage: {device.voltage ? formatNumber(device.voltage) : 'N/A'}V</text>
            <text x="130" y="225" fill="#7dd3fc" fontSize="12" fontFamily="monospace">VCC: {device.vcc ? formatNumber(device.vcc) : 'N/A'}V</text>
            {/* Buttons */}
            <rect x="70" y="180" width="30" height="20" rx="2" fill="#1a1f28" stroke="#00ff88" strokeWidth="1"/>
            <rect x="70" y="210" width="30" height="20" rx="2" fill="#1a1f28" stroke="#00ff88" strokeWidth="1"/>
            <rect x="300" y="180" width="30" height="20" rx="2" fill="#1a1f28" stroke="#00ff88" strokeWidth="1"/>
            <rect x="300" y="210" width="30" height="20" rx="2" fill="#1a1f28" stroke="#00ff88" strokeWidth="1"/>
            {/* Chip grid on top */}
            <g>
              {[0, 1, 2, 3, 4].map((col) => 
                [0, 1, 2].map((row) => (
                  <rect
                    key={`${col}-${row}`}
                    x={80 + col * 48}
                    y={50 + row * 48}
                    width="40"
                    height="40"
                    rx="2"
                    fill="#3a3a3a"
                    stroke="#00ff88"
                    strokeWidth="1"
                    opacity="0.6"
                  />
                ))
              )}
            </g>
            {/* Status indicator */}
            <circle cx="320" cy="200" r="8" fill={getStatusColor()} opacity="0.8">
              <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite"/>
            </circle>
          </svg>
        </div>
        <div className="device-status-badge" style={{ backgroundColor: getStatusColor() }}>
          {device.status.toUpperCase()}
        </div>
      </div>

      <div className="device-info">
        <div className="device-header">
          <h3 className="device-name">{device.name}</h3>
          <span className="device-id">{device.id}</span>
        </div>

        <div className="device-location">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 0C4.134 0 1 3.134 1 7c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7zm0 9.5c-1.381 0-2.5-1.119-2.5-2.5S6.619 4.5 8 4.5s2.5 1.119 2.5 2.5S9.381 9.5 8 9.5z" fill="currentColor"/>
          </svg>
          {device.location}
        </div>

        <div className="device-metrics">
          <div className="metric-row">
            <span className="metric-label">Temperature:</span>
            <span className="metric-value">{device.temperature ? formatNumber(device.temperature) : 'N/A'}°C</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Voltage:</span>
            <span className="metric-value">{device.voltage ? formatNumber(device.voltage) : 'N/A'}V</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">VCC:</span>
            <span className="metric-value">{device.vcc ? formatNumber(device.vcc) : 'N/A'}V</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Sensors:</span>
            <span className="metric-value">{device.sensorCount || 0} active</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Uptime:</span>
            <span className="metric-value">{formatUptime(device.uptime)}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Data Points:</span>
            <span className="metric-value">{device.dataPoints ? device.dataPoints.toLocaleString() : '0'}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Sample Rate:</span>
            <span className="metric-value">{device.sampleRate ? formatNumber(device.sampleRate, 2) : '0.00'} Hz</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Last Update:</span>
            <span className="metric-value">{device.lastUpdate || 'Never'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeviceCard

