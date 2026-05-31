import { useMemo } from 'react'
import { DeviceData } from '../services/deviceService'
import './SensorGrid.css'

interface SensorGridProps {
  device: DeviceData
  parameter: 'temperature' | 'humidity' | 'voltage' | 'adc'
  isFullData?: boolean
}

interface SensorValue {
  id: string
  heaterProfile: string
}

const SensorGrid = ({ device, parameter: _parameter, isFullData = true }: SensorGridProps) => {
  const sensors = useMemo<SensorValue[]>(() =>
    device.sensors.map((sensor) => ({
      id: sensor.id,
      heaterProfile: sensor.activeHeaterProfile ?? 'N/A',
    })),
  [device.sensors])

  const getSensorColor = (sensorId: string): string => {
    const sensorNumStr = sensorId.replace('BME_', '').replace('BME', '').replace('_', '')
    const sensorNum = parseInt(sensorNumStr) || 1
    const group = Math.floor((sensorNum - 1) / 4)
    const colors = [
      ['#00d4ff', '#00a8cc', '#007a99', '#004c66'],
      ['#00ff88', '#00cc6a', '#00994d', '#006630'],
      ['#ffb800', '#cc9300', '#996e00', '#664900'],
      ['#ff4444', '#cc3636', '#992828', '#661a1a'],
    ]
    const indexInGroup = (sensorNum - 1) % 4
    return colors[group]?.[indexInGroup] || '#7dd3fc'
  }

  if (!isFullData) {
    return (
      <div className="sensor-grid-loading">
        <p>Loading sensors...</p>
      </div>
    )
  }

  if (sensors.length === 0) {
    return (
      <div className="sensor-grid-empty">
        <p>No sensor data available</p>
      </div>
    )
  }

  const groupedSensors: SensorValue[][] = []
  for (let i = 0; i < sensors.length; i += 4) {
    groupedSensors.push(sensors.slice(i, i + 4))
  }

  return (
    <div className="sensor-grid">
      {groupedSensors.map((group, groupIndex) => (
        <div key={groupIndex} className="sensor-group">
          {group.map((sensor) => (
            <div key={sensor.id} className="sensor-tile" style={{ borderColor: getSensorColor(sensor.id) }}>
              <div className="sensor-tile-header">
                <span className="sensor-tile-id">{sensor.id}</span>
              </div>
              <div className="sensor-tile-value-container">
                <span className="sensor-tile-heater-profile">{sensor.heaterProfile}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default SensorGrid
