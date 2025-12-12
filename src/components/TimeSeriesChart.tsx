import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { subscribeToSensorTimeSeriesData, SensorTimeSeriesDataPoint } from '../services/deviceService'
import './TimeSeriesChart.css'

interface TimeSeriesChartProps {
  deviceId: string
  parameter: 'temperature' | 'humidity' | 'voltage' | 'adc'
}

const TimeSeriesChart = ({ deviceId, parameter }: TimeSeriesChartProps) => {
  const [data, setData] = useState<SensorTimeSeriesDataPoint[]>([])
  const [sensorIds, setSensorIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedSensors, setSelectedSensors] = useState<Set<string>>(new Set())
  
  const parameterConfig = {
    temperature: { color: '#00d4ff', label: 'Temperature (°C)', unit: '°C' },
    humidity: { color: '#00ff88', label: 'Humidity (%RH)', unit: '%RH' },
    voltage: { color: '#ffb800', label: 'Voltage (V)', unit: 'V' },
    adc: { color: '#ff4444', label: 'ADC', unit: '' }
  }
  
  const config = parameterConfig[parameter]
  
  // Generate colors for 16 sensors (4 groups)
  const getSensorColor = (sensorId: string): string => {
    const sensorNum = parseInt(sensorId.replace('BME', ''))
    const group = Math.floor((sensorNum - 1) / 4)
    const colors = [
      ['#00d4ff', '#00a8cc', '#007a99', '#004c66'], // Group 1: Blues
      ['#00ff88', '#00cc6a', '#00994d', '#006630'], // Group 2: Greens
      ['#ffb800', '#cc9300', '#996e00', '#664900'], // Group 3: Yellows
      ['#ff4444', '#cc3636', '#992828', '#661a1a']  // Group 4: Reds
    ]
    const indexInGroup = (sensorNum - 1) % 4
    return colors[group]?.[indexInGroup] || '#7dd3fc'
  }

  useEffect(() => {
    setIsLoading(true)

    const unsubscribe = subscribeToSensorTimeSeriesData(
      deviceId,
      parameter,
      (timeSeriesData, sensors) => {
        setData(timeSeriesData)
        setSensorIds(sensors)
        // Initialize all sensors as selected when sensors are first loaded
        setSelectedSensors(prev => {
          if (prev.size === 0) {
            return new Set(sensors)
          }
          return prev
        })
        setIsLoading(false)
      },
      (error) => {
        console.error('Error loading time-series data:', error)
        setIsLoading(false)
      },
      60 // Limit to last 60 data points
    )

    return () => {
      unsubscribe()
    }
  }, [deviceId, parameter])

  if (isLoading) {
    return (
      <div className="chart-loading">
        <p>Loading chart data...</p>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="chart-empty">
        <p>No time-series data available</p>
      </div>
    )
  }

  return (
    <div className="time-series-chart">
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-color)" />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={['dataMin', 'dataMax']}
              stroke="var(--text-secondary)"
              tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
              interval={Math.max(0, Math.floor(data.length / 10))}
              tickFormatter={(value) => {
                const date = new Date(value)
                // Format as "MM/DD HH:MM" to show date and time for proper chronological ordering
                const month = String(date.getMonth() + 1).padStart(2, '0')
                const day = String(date.getDate()).padStart(2, '0')
                const hours = String(date.getHours()).padStart(2, '0')
                const minutes = String(date.getMinutes()).padStart(2, '0')
                return `${month}/${day} ${hours}:${minutes}`
              }}
            />
            <YAxis
              stroke="var(--text-secondary)"
              tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
              domain={['auto', 'auto']}
              label={{ value: config.label, angle: -90, position: 'insideLeft', style: { fill: 'var(--text-secondary)' } }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '2px',
                color: 'var(--text-primary)'
              }}
              labelStyle={{ color: 'var(--text-secondary)' }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
            {sensorIds.map((sensorId) => {
              if (!selectedSensors.has(sensorId)) {
                return null
              }
              return (
                <Line
                  key={sensorId}
                  type="monotone"
                  dataKey={sensorId}
                  stroke={getSensorColor(sensorId)}
                  strokeWidth={1.5}
                  dot={false}
                  name={sensorId}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-legend-custom">
        <div className="legend-header">
          <div className="legend-title">Sensors (click to toggle):</div>
          <div className="legend-controls">
            <button
              className="legend-control-button"
              onClick={() => {
                setSelectedSensors(new Set(sensorIds))
              }}
            >
              Select All
            </button>
            <button
              className="legend-control-button"
              onClick={() => {
                setSelectedSensors(new Set())
              }}
            >
              Deselect All
            </button>
          </div>
        </div>
        <div className="legend-items">
          {sensorIds.map((sensorId) => {
            const isSelected = selectedSensors.has(sensorId)
            return (
              <div
                key={sensorId}
                className={`legend-item ${isSelected ? 'selected' : 'deselected'}`}
                onClick={() => {
                  setSelectedSensors(prev => {
                    const newSet = new Set(prev)
                    if (newSet.has(sensorId)) {
                      newSet.delete(sensorId)
                    } else {
                      newSet.add(sensorId)
                    }
                    return newSet
                  })
                }}
                style={{
                  color: getSensorColor(sensorId),
                  cursor: 'pointer'
                }}
              >
                <span className="legend-icon" style={{ backgroundColor: getSensorColor(sensorId) }}></span>
                <span className="legend-label">{sensorId}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="chart-info">
        <div className="info-item">
          <span className="info-label">Data Points:</span>
          <span className="info-value">{data.length}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Sampling Rate:</span>
          <span className="info-value">1 min</span>
        </div>
        <div className="info-item">
          <span className="info-label">Time Range:</span>
          <span className="info-value">60 min</span>
        </div>
      </div>
    </div>
  )
}

export default TimeSeriesChart

