import { useMemo } from 'react'
import { DeviceData } from '../services/deviceService'
import { getSensorColor } from '../utils/sensorColors'
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
      heaterProfile: sensor.activeHeaterProfile ?? '—',
    })),
  [device.sensors])

  if (!isFullData) {
    return (
      <div className="sensor-grid-loading">
        <p>Loading sensor channels…</p>
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
            <div
              key={sensor.id}
              className="sensor-tile"
              style={{ borderLeftColor: getSensorColor(sensor.id) }}
            >
              <div className="sensor-tile-header">
                <span className="sensor-tile-id">{sensor.id}</span>
              </div>
              <span className="sensor-tile-label">Heater Profile</span>
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
