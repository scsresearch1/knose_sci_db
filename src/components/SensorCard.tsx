import { useState, useEffect } from 'react'
import './SensorCard.css'

interface SensorCardProps {
  sensor: {
    id: string
    name: string
    value: number
    unit: string
    status: 'normal' | 'warning' | 'error'
    trend: 'up' | 'down' | 'stable'
  }
}

const SensorCard = ({ sensor }: SensorCardProps) => {
  const [displayValue, setDisplayValue] = useState(sensor.value)

  useEffect(() => {
    // Simulate slight value fluctuations
    const interval = setInterval(() => {
      const variation = (Math.random() - 0.5) * 0.1
      setDisplayValue(prev => prev + variation)
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const formatValue = (value: number): string => {
    if (value >= 1000) {
      return value.toFixed(0)
    }
    if (value >= 100) {
      return value.toFixed(1)
    }
    if (value >= 10) {
      return value.toFixed(2)
    }
    return value.toFixed(3)
  }

  const getTrendIcon = () => {
    switch (sensor.trend) {
      case 'up':
        return '↑'
      case 'down':
        return '↓'
      default:
        return '→'
    }
  }

  const getStatusColor = () => {
    switch (sensor.status) {
      case 'warning':
        return 'var(--accent-warning)'
      case 'error':
        return 'var(--accent-error)'
      default:
        return 'var(--accent-secondary)'
    }
  }

  return (
    <div className="sensor-card">
      <div className="sensor-header">
        <span className="sensor-name">{sensor.name}</span>
        <span 
          className="sensor-status" 
          style={{ color: getStatusColor() }}
        >
          ●
        </span>
      </div>
      <div className="sensor-value-container">
        <span className="sensor-value">{formatValue(displayValue)}</span>
        <span className="sensor-unit">{sensor.unit}</span>
      </div>
      <div className="sensor-footer">
        <span className={`sensor-trend trend-${sensor.trend}`}>
          {getTrendIcon()}
        </span>
        <span className="sensor-id">{sensor.id}</span>
      </div>
    </div>
  )
}

export default SensorCard

