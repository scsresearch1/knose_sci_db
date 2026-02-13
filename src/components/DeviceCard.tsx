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
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M8 4v4l2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Last updated: {device.lastUpdateTimestamp || device.lastUpdate || 'Never'}</span>
        </div>
      </div>
    </div>
  )
}

export default DeviceCard

