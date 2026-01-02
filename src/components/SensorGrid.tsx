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
  heaterProfile: string // HP_301, HP_302, etc.
  value?: number // Optional: parameter value if needed later
  unit?: string // Optional: unit if needed later
}

const SensorGrid = ({ deviceId, parameter: _parameter }: SensorGridProps) => {
  const [sensors, setSensors] = useState<SensorValue[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Note: parameter prop is kept for future use if needed, but currently showing heater profiles

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
            
            // Get heater profile for each sensor individually (all 16 BME sensors)
            sensorIds.forEach((sensorId) => {
              const sensorData = deviceData[sensorId]
              if (sensorData) {
                // Find all heater profiles (HP_XXX) for this sensor
                const heaterProfiles: Array<{ hpId: string; latestTimestamp: string }> = []
                
                // Debug: log all keys to see what we're working with
                const allKeys = Object.keys(sensorData)
                console.log(`[SensorGrid] ${sensorId} - All keys found:`, allKeys)
                
                Object.keys(sensorData).forEach((hpId) => {
                  // Check if it's a heater profile (starts with Hp_ or HP_)
                  // Note: Firebase data uses Hp_ (lowercase 'p')
                  if (hpId.startsWith('Hp_') || hpId.startsWith('HP_')) {
                    const hpData = sensorData[hpId]
                    if (hpData && typeof hpData === 'object') {
                      // Get all timestamps for this heater profile
                      const timestamps = Object.keys(hpData).filter(ts => {
                        const reading = hpData[ts]
                        return reading && typeof reading === 'object'
                      })
                      
                      console.log(`[SensorGrid] ${sensorId} - Found heater profile ${hpId} with ${timestamps.length} timestamps`)
                      
                      if (timestamps.length > 0) {
                        // Sort timestamps chronologically
                        timestamps.sort((a, b) => {
                          const timeA = parseTimestamp(a).getTime()
                          const timeB = parseTimestamp(b).getTime()
                          return timeA - timeB
                        })
                        
                        // Get the latest timestamp for this heater profile
                        const latestTimestamp = timestamps[timestamps.length - 1]
                        heaterProfiles.push({ hpId, latestTimestamp })
                      }
                    }
                  }
                })
                
                // Sort heater profiles by latest timestamp (most recent first)
                heaterProfiles.sort((a, b) => {
                  const timeA = parseTimestamp(a.latestTimestamp).getTime()
                  const timeB = parseTimestamp(b.latestTimestamp).getTime()
                  return timeB - timeA // Descending order (newest first)
                })
                
                // Get the most active/recent heater profile
                const activeHeaterProfile = heaterProfiles.length > 0 
                  ? heaterProfiles[0].hpId 
                  : 'N/A'
                
                console.log(`[SensorGrid] ${sensorId} - Total heater profiles: ${heaterProfiles.length}, Active: ${activeHeaterProfile}`)
                
                sensorValues.push({
                  id: sensorId,
                  heaterProfile: activeHeaterProfile
                })
              } else {
                console.log(`[SensorGrid] ${sensorId} - No sensor data found`)
                sensorValues.push({
                  id: sensorId,
                  heaterProfile: 'N/A'
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
  }, [deviceId]) // Removed parameter and config.unit since we're showing heater profiles

  // No longer needed since we're showing heater profiles, not values
  // const formatValue = (value: number): string => { ... }

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

