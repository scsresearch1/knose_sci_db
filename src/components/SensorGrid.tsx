import { useState, useEffect } from 'react'
import { ref, onValue, off } from 'firebase/database'
import { database } from '../config/firebase'
import { parseTimestamp } from '../services/deviceService'
import './SensorGrid.css'

interface SensorGridProps {
  deviceId: string
  parameter: 'temperature' | 'humidity' | 'voltage' | 'adc'
}

interface SensorValue {
  id: string
  value: number
  unit: string
}

const SensorGrid = ({ deviceId, parameter }: SensorGridProps) => {
  const [sensors, setSensors] = useState<SensorValue[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const parameterConfig = {
    temperature: { unit: '°C', label: 'Temperature' },
    humidity: { unit: '%RH', label: 'Humidity' },
    voltage: { unit: 'V', label: 'Voltage' },
    adc: { unit: '', label: 'ADC' }
  }

  const config = parameterConfig[parameter]

  useEffect(() => {
    setIsLoading(true)

    const deviceRef = ref(database, deviceId)
    
    const unsubscribe = onValue(
      deviceRef,
      (snapshot) => {
        try {
          const deviceData = snapshot.val()
          if (deviceData) {
            const sensorValues: SensorValue[] = []
            const sensorIds: string[] = []
            
            // Collect all sensor IDs
            Object.keys(deviceData).forEach((key) => {
              if (key.startsWith('BME')) {
                sensorIds.push(key)
              }
            })
            sensorIds.sort()
            
            // Get latest reading from each sensor individually
            sensorIds.forEach((sensorId) => {
              const sensorData = deviceData[sensorId]
              if (sensorData) {
                // Collect all timestamps from all Hp entries for this sensor
                const allTimestamps: Array<{ timestamp: string; reading: any }> = []
                
                Object.keys(sensorData).forEach((hpId) => {
                  const hpData = sensorData[hpId]
                  if (hpData && typeof hpData === 'object') {
                    Object.keys(hpData).forEach((timestampStr) => {
                      const reading = hpData[timestampStr]
                      if (reading && typeof reading === 'object') {
                        allTimestamps.push({ timestamp: timestampStr, reading })
                      }
                    })
                  }
                })
                
                // Sort timestamps chronologically
                allTimestamps.sort((a, b) => {
                  const timeA = parseTimestamp(a.timestamp).getTime()
                  const timeB = parseTimestamp(b.timestamp).getTime()
                  return timeA - timeB
                })
                
                if (allTimestamps.length > 0) {
                  // Get the latest reading for this specific sensor (chronologically)
                  const latestEntry = allTimestamps[allTimestamps.length - 1]
                  const reading = latestEntry.reading
                  
                  if (reading && typeof reading === 'object') {
                    // Get the value for the selected parameter
                    // Map parameter names: adc -> gas_adc, others are lowercase
                    const paramKey = parameter === 'adc' ? 'gas_adc' : parameter
                    const value = reading[paramKey] ?? 0
                    
                    sensorValues.push({
                      id: sensorId,
                      value,
                      unit: config.unit
                    })
                  } else {
                    sensorValues.push({
                      id: sensorId,
                      value: 0,
                      unit: config.unit
                    })
                  }
                } else {
                  sensorValues.push({
                    id: sensorId,
                    value: 0,
                    unit: config.unit
                  })
                }
              } else {
                sensorValues.push({
                  id: sensorId,
                  value: 0,
                  unit: config.unit
                })
              }
            })
            
            setSensors(sensorValues)
            setIsLoading(false)
          } else {
            setSensors([])
            setIsLoading(false)
          }
        } catch (error) {
          console.error('Error loading sensor readings:', error)
          setIsLoading(false)
        }
      },
      (error) => {
        console.error('Firebase error:', error)
        setIsLoading(false)
      }
    )

    return () => {
      off(deviceRef)
      unsubscribe()
    }
  }, [deviceId, parameter, config.unit])

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

  const getSensorColor = (sensorId: string): string => {
    // Handle both BME_01 and BME01 formats
    const sensorNumStr = sensorId.replace('BME_', '').replace('BME', '').replace('_', '')
    const sensorNum = parseInt(sensorNumStr) || 1
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

  if (isLoading) {
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

  // Group sensors by 4
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
                <span className="sensor-tile-value">{formatValue(sensor.value)}</span>
                <span className="sensor-tile-unit">{sensor.unit}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default SensorGrid

