import { ref, onValue, off, get } from 'firebase/database'
import { database } from '../config/firebase'

export interface SensorDataPoint {
  gas_adc: number
  humidity: number
  temperature: number
  voltage: number
}

export interface SensorTimestamp {
  timestamp: string // Format: "2025-01-01_19-29-47"
  data: SensorDataPoint
}

export interface SensorData {
  id: string // BME_01 to BME_16 (16 sensors per device)
  readings: SensorTimestamp[]
  latestReading?: SensorDataPoint
}

export interface DeviceData {
  id: string // Device_1 to Device_10 (10 devices total)
  name: string
  location: string
  status: 'online' | 'offline' | 'warning'
  sensors: SensorData[] // Should contain 16 sensors (BME_01 to BME_16)
  sensorCount: number
  lastUpdate: string
  // Calculated fields
  temperature?: number
  voltage?: number
  vcc?: number
  uptime?: number
  dataPoints?: number
  sampleRate?: number
}

export interface SensorReading {
  id: string
  name: string
  value: number
  unit: string
  status: 'normal' | 'warning' | 'error'
  trend: 'up' | 'down' | 'stable'
  timestamp: number
}

export interface TimeSeriesDataPoint {
  time: string
  temperature: number
  humidity: number
  voltage: number
  adc: number
  timestamp: number
}

export interface SensorTimeSeriesDataPoint {
  time: string
  timestamp: number
  timestampStr?: string // Original timestamp string for formatting (YYYY-MM-DD_HH-MM-SEC_NanoSEC)
  [sensorId: string]: string | number | undefined // Dynamic sensor IDs (BME01, BME02, etc.) with their values
}

/**
 * Parse timestamp string to Date
 * Format: "2026-01-01_15-13-29_679689000" (YYYY-MM-DD_HH-MM-SEC_NanoSEC)
 */
export const parseTimestamp = (timestampStr: string): Date => {
  // Split by underscore: [datePart, timePart, nanoPart]
  const parts = timestampStr.split('_')
  if (parts.length < 2) {
    console.error('Invalid timestamp format:', timestampStr)
    return new Date(0)
  }
  
  const [datePart, timePart] = parts
  if (!datePart || !timePart) {
    console.error('Invalid timestamp format:', timestampStr)
    return new Date(0)
  }
  
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute, second] = timePart.split('-').map(Number)
  
  // Validate parsed values
  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute) || isNaN(second)) {
    console.error('Invalid timestamp values:', { year, month, day, hour, minute, second, timestampStr })
    return new Date(0)
  }
  
  return new Date(year, month - 1, day, hour, minute, second)
}

/**
 * Format timestamp string to display format
 * Input: "2026-01-01_15-13-29_679689000" (YYYY-MM-DD_HH-MM-SEC_NanoSEC)
 * Output: "01-01-2026-15:13:29:679689000" (MM-DD-YYYY-HH:MM:SS:NS)
 */
export const formatTimestampForDisplay = (timestampStr: string): string => {
  const parts = timestampStr.split('_')
  if (parts.length < 2) {
    return timestampStr // Return as-is if format is unexpected
  }
  
  const [datePart, timePart, nanoPart] = parts
  const [year, month, day] = datePart.split('-')
  const [hour, minute, second] = timePart.split('-')
  
  // Format as MM-DD-YYYY-HH:MM:SS:NS
  const formatted = `${month}-${day}-${year}-${hour}:${minute}:${second}${nanoPart ? `:${nanoPart}` : ''}`
  return formatted
}

/**
 * Format timestamp to readable string
 */
const formatLastUpdate = (timestampStr: string): string => {
  const timestamp = parseTimestamp(timestampStr)
  const now = new Date()
  const diffSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000)
  
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`
  } else if (diffSeconds < 3600) {
    return `${Math.floor(diffSeconds / 60)}m ago`
  } else {
    return `${Math.floor(diffSeconds / 3600)}h ago`
  }
}

/**
 * Process device data from Firebase
 * Structure: Device_X -> BME_XX -> HP_XXX -> timestamp -> {gas_adc, humidity, temperature, voltage}
 * - Device_1 to Device_10 (10 devices)
 * - Each device has 16 BME sensors (BME_01 to BME_16)
 * - Each sensor runs heater profiles like HP_301, HP_302, etc.
 * - Each heater profile contains timestamped readings
 */
interface FirebaseDeviceData {
  [sensorId: string]: {
    [hpId: string]: { // HP_301, HP_302, etc. (heater profile IDs)
      [timestamp: string]: {
        gas_adc?: number
        humidity?: number
        temperature?: number
        voltage?: number
      }
    }
  }
}

const processDeviceData = (deviceId: string, deviceData: FirebaseDeviceData): DeviceData => {
  const sensors: SensorData[] = []
  let latestTimestamp = ''
  let earliestTimestamp = ''
  let totalReadings = 0

  // Debug: Log device structure to verify Firebase mapping
  const deviceKeys = Object.keys(deviceData)
  const sensorKeys = deviceKeys.filter(key => key.startsWith('BME'))
  console.log(`[deviceService] Processing ${deviceId}:`, {
    totalKeys: deviceKeys.length,
    sensorKeys: sensorKeys,
    sensorCount: sensorKeys.length
  })

  // Process each sensor (BME_01-BME_16 - all 16 sensors per device)
  Object.keys(deviceData).forEach((sensorId) => {
    if (sensorId.startsWith('BME')) {
      const sensorReadings: SensorTimestamp[] = []
      
      // Process heater profile entries (HP_301, HP_302, etc.)
      // Each sensor can have multiple heater profiles
      Object.keys(deviceData[sensorId]).forEach((hpId) => {
        const hpData = deviceData[sensorId][hpId]
        if (hpData && typeof hpData === 'object') {
          // Process timestamp entries within this heater profile
          Object.keys(hpData).forEach((timestampStr) => {
            const reading = hpData[timestampStr]
            if (reading && typeof reading === 'object') {
              sensorReadings.push({
                timestamp: timestampStr,
                data: {
                  gas_adc: reading.gas_adc || 0,
                  humidity: reading.humidity || 0,
                  temperature: reading.temperature || 0,
                  voltage: reading.voltage || 0,
                },
              })
              totalReadings++
              
              // Track latest timestamp
              if (!latestTimestamp || timestampStr > latestTimestamp) {
                latestTimestamp = timestampStr
              }
              
              // Track earliest timestamp (for uptime calculation)
              if (!earliestTimestamp || timestampStr < earliestTimestamp) {
                earliestTimestamp = timestampStr
              }
            }
          })
        }
      })

      // Sort by timestamp
      sensorReadings.sort((a, b) => 
        parseTimestamp(a.timestamp).getTime() - parseTimestamp(b.timestamp).getTime()
      )

      // Get latest reading
      const latestReading = sensorReadings.length > 0 
        ? sensorReadings[sensorReadings.length - 1].data 
        : undefined

      sensors.push({
        id: sensorId,
        readings: sensorReadings,
        latestReading,
      })
    }
  })

  // Sort sensors by ID to ensure proper grouping (BME_01, BME_02, ..., BME_16)
  sensors.sort((a, b) => {
    // Extract sensor numbers for comparison
    const numA = parseInt(a.id.replace('BME_', '').replace('BME', '').replace('_', '')) || 0
    const numB = parseInt(b.id.replace('BME_', '').replace('BME', '').replace('_', '')) || 0
    return numA - numB
  })

  // Get readings from the latest timestamp across all sensors
  // Find all sensors that have data at the latest timestamp
  const readingsAtLatestTimestamp: SensorDataPoint[] = []
  if (latestTimestamp) {
    sensors.forEach(sensor => {
      // Find reading at the latest timestamp for this sensor
      const readingAtLatest = sensor.readings.find(r => r.timestamp === latestTimestamp)
      if (readingAtLatest) {
        readingsAtLatestTimestamp.push(readingAtLatest.data)
      }
    })
  }

  // Calculate aggregate values from readings at the latest timestamp
  const avgTemperature = readingsAtLatestTimestamp.length > 0
    ? readingsAtLatestTimestamp.reduce((sum, r) => sum + r.temperature, 0) / readingsAtLatestTimestamp.length
    : 0

  const avgVoltage = readingsAtLatestTimestamp.length > 0
    ? readingsAtLatestTimestamp.reduce((sum, r) => sum + r.voltage, 0) / readingsAtLatestTimestamp.length
    : 0

  // Determine status based on data freshness
  const lastUpdateTime = latestTimestamp ? parseTimestamp(latestTimestamp) : new Date(0)
  const secondsSinceUpdate = (new Date().getTime() - lastUpdateTime.getTime()) / 1000
  let status: 'online' | 'offline' | 'warning' = 'online'
  if (secondsSinceUpdate > 300) {
    status = 'offline'
  } else if (secondsSinceUpdate > 60) {
    status = 'warning'
  }

  // Calculate uptime: sum of intervals between consecutive timestamps
  // Collect all timestamps from all sensors, sort them, and sum the intervals
  let uptime: number | undefined = undefined
  if (sensors.length > 0) {
    // Collect all unique timestamps from all sensors
    const allTimestamps: string[] = []
    sensors.forEach(sensor => {
      sensor.readings.forEach(reading => {
        if (reading.timestamp && !allTimestamps.includes(reading.timestamp)) {
          allTimestamps.push(reading.timestamp)
        }
      })
    })
    
    if (allTimestamps.length > 1) {
      // Sort all timestamps chronologically
      allTimestamps.sort((a, b) => {
        const timeA = parseTimestamp(a).getTime()
        const timeB = parseTimestamp(b).getTime()
        return timeA - timeB
      })
      
      // Debug: log first and last timestamps
      console.log(`[${deviceId}] Uptime calculation:`, {
        totalTimestamps: allTimestamps.length,
        first: allTimestamps[0],
        last: allTimestamps[allTimestamps.length - 1],
        firstTime: parseTimestamp(allTimestamps[0]),
        lastTime: parseTimestamp(allTimestamps[allTimestamps.length - 1])
      })
      
      // Sum intervals between consecutive timestamps
      // Only count intervals that are reasonable (within 1 hour) to avoid counting gaps
      // between different data collection sessions
      const MAX_INTERVAL_SECONDS = 3600 // 1 hour - if gap is larger, it's a new session
      let totalUptime = 0
      for (let i = 0; i < allTimestamps.length - 1; i++) {
        const currentTime = parseTimestamp(allTimestamps[i]).getTime()
        const nextTime = parseTimestamp(allTimestamps[i + 1]).getTime()
        const intervalSeconds = (nextTime - currentTime) / 1000
        
        // Only sum intervals that are within reasonable threshold (active session)
        if (intervalSeconds > 0 && intervalSeconds <= MAX_INTERVAL_SECONDS) {
          totalUptime += intervalSeconds
        } else if (intervalSeconds > MAX_INTERVAL_SECONDS) {
          // Large gap detected - this is likely a break between sessions
          console.log(`[${deviceId}] Skipping large gap:`, {
            from: allTimestamps[i],
            to: allTimestamps[i + 1],
            intervalSeconds,
            intervalHours: intervalSeconds / 3600
          })
        }
      }
      uptime = Math.floor(totalUptime)
      
      const days = Math.floor(uptime / 86400)
      const hours = Math.floor((uptime % 86400) / 3600)
      const minutes = Math.floor((uptime % 3600) / 60)
      const secs = Math.floor(uptime % 60)
      console.log(`[${deviceId}] Calculated uptime:`, uptime, 'seconds =', `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`)
    } else if (allTimestamps.length === 1) {
      uptime = 0
    }
  }

  // Extract device number from Device_X format (Device_1, Device_2, etc.)
  const deviceNum = deviceId.replace('Device_', '')
  
  return {
    id: deviceId,
    name: `BME690 Sensor Array #${deviceNum.padStart(2, '0')}`,
    location: `Lab ${String.fromCharCode(64 + (parseInt(deviceNum) || 1) % 3 + 1)} - Chamber ${Math.ceil((parseInt(deviceNum) || 1) / 3)}`,
    status,
    sensors, // All 16 BME sensors grouped together for this device (BME_01 to BME_16)
    sensorCount: sensors.length, // Should be 16 sensors per device
    lastUpdate: latestTimestamp ? formatLastUpdate(latestTimestamp) : 'Never',
    temperature: avgTemperature,
    voltage: avgVoltage,
    vcc: avgVoltage * 1.84, // Approximate VCC calculation
    uptime,
    dataPoints: totalReadings,
    sampleRate: sensors.length > 0 && sensors[0].readings.length > 1
      ? calculateSampleRate(sensors[0].readings)
      : 0,
  }
}

/**
 * Calculate sample rate from readings
 */
const calculateSampleRate = (readings: SensorTimestamp[]): number => {
  if (readings.length < 2) return 0
  
  const timestamps = readings.map(r => parseTimestamp(r.timestamp).getTime())
  const intervals: number[] = []
  
  for (let i = 1; i < timestamps.length; i++) {
    intervals.push((timestamps[i] - timestamps[i - 1]) / 1000) // Convert to seconds
  }
  
  const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
  return avgInterval > 0 ? 1 / avgInterval : 0
}

/**
 * Subscribe to device data changes
 * Supports all 10 devices: Device_1 through Device_10
 * Each device contains 16 BME sensors (BME_01 to BME_16) grouped together
 */
export const subscribeToDevices = (
  callback: (devices: DeviceData[]) => void,
  onError?: (error: Error) => void
) => {
  const devicesRef = ref(database)
  
  const unsubscribe = onValue(
    devicesRef,
    (snapshot) => {
      try {
        const data = snapshot.val()
        if (data) {
          // Filter and process only devices matching Device_X pattern (Device_1 to Device_10)
          // Each device contains 16 BME sensors grouped together
          const devicesArray: DeviceData[] = Object.keys(data)
            .filter(key => key.startsWith('Device_') && /^Device_\d+$/.test(key))
            .map((deviceId) => processDeviceData(deviceId, data[deviceId]))
            .sort((a, b) => {
              // Sort by device number (1-10)
              const numA = parseInt(a.id.replace('Device_', '')) || 0
              const numB = parseInt(b.id.replace('Device_', '')) || 0
              return numA - numB
            })
          
          callback(devicesArray)
        } else {
          callback([])
        }
      } catch (error) {
        console.error('Error processing devices:', error)
        if (onError) {
          onError(error as Error)
        }
      }
    },
    (error) => {
      console.error('Firebase error:', error)
      if (onError) {
        onError(error)
      }
    }
  )

  return () => {
    off(devicesRef)
    unsubscribe()
  }
}

/**
 * Get a single device by ID (one-time fetch)
 */
export const getDevice = async (deviceId: string): Promise<DeviceData | null> => {
  try {
    const deviceRef = ref(database, deviceId)
    const snapshot = await get(deviceRef)
    
    if (snapshot.exists()) {
      return processDeviceData(deviceId, snapshot.val())
    }
    return null
  } catch (error) {
    console.error('Error fetching device:', error)
    throw error
  }
}

/**
 * Subscribe to real-time updates for a single device
 */
export const subscribeToDevice = (
  deviceId: string,
  callback: (device: DeviceData | null) => void,
  onError?: (error: Error) => void
) => {
  const deviceRef = ref(database, deviceId)
  
  const unsubscribe = onValue(
    deviceRef,
    (snapshot) => {
      try {
        if (snapshot.exists()) {
          const rawData = snapshot.val()
          console.log(`[deviceService] subscribeToDevice(${deviceId}): Received data, keys:`, Object.keys(rawData))
          const deviceData = processDeviceData(deviceId, rawData)
          callback(deviceData)
        } else {
          console.warn(`[deviceService] subscribeToDevice(${deviceId}): Device not found in Firebase`)
          callback(null)
        }
      } catch (error) {
        console.error('Error processing device:', error)
        if (onError) {
          onError(error as Error)
        }
      }
    },
    (error) => {
      console.error('Firebase error:', error)
      if (onError) {
        onError(error)
      }
    }
  )

  return () => {
    off(deviceRef)
    unsubscribe()
  }
}

/**
 * Subscribe to sensor readings for a specific device
 */
export const subscribeToSensorReadings = (
  deviceId: string,
  callback: (readings: SensorReading[]) => void,
  onError?: (error: Error) => void
) => {
  const deviceRef = ref(database, deviceId)
  
  const unsubscribe = onValue(
    deviceRef,
    (snapshot) => {
      try {
        const deviceData = snapshot.val()
        if (deviceData) {
          const readings: SensorReading[] = []
          
          // Process each sensor (all 16 BME sensors)
          Object.keys(deviceData).forEach((sensorId) => {
            if (sensorId.startsWith('BME')) {
              const sensorData = deviceData[sensorId]
              
              // Collect all timestamps from all heater profiles (HP_301, HP_302, etc.)
              const allTimestamps: Array<{ timestamp: string; data: SensorDataPoint }> = []
              
              Object.keys(sensorData).forEach((hpId) => {
                const hpData = sensorData[hpId]
                if (hpData && typeof hpData === 'object') {
                  Object.keys(hpData).forEach((timestampStr) => {
                    const reading = hpData[timestampStr]
                    if (reading && typeof reading === 'object') {
                      allTimestamps.push({
                        timestamp: timestampStr,
                        data: {
                          gas_adc: reading.gas_adc || 0,
                          humidity: reading.humidity || 0,
                          temperature: reading.temperature || 0,
                          voltage: reading.voltage || 0,
                        }
                      })
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
                const latestEntry = allTimestamps[allTimestamps.length - 1]
                const latestData = latestEntry.data
                const prevEntry = allTimestamps.length > 1 ? allTimestamps[allTimestamps.length - 2] : null
                const prevData = prevEntry ? prevEntry.data : null
                
                // Determine trend
                let trend: 'up' | 'down' | 'stable' = 'stable'
                if (prevData) {
                  const tempDiff = latestData.temperature - prevData.temperature
                  if (Math.abs(tempDiff) > 0.1) {
                    trend = tempDiff > 0 ? 'up' : 'down'
                  }
                }
                
                // Determine status
                let status: 'normal' | 'warning' | 'error' = 'normal'
                if (latestData.temperature > 30 || latestData.temperature < 10) {
                  status = 'warning'
                }
                if (latestData.voltage < 2.5) {
                  status = 'error'
                }
                
                readings.push({
                  id: sensorId,
                  name: `${sensorId} - Temperature`,
                  value: latestData.temperature,
                  unit: '°C',
                  status,
                  trend,
                  timestamp: parseTimestamp(latestEntry.timestamp).getTime(),
                })
                
                readings.push({
                  id: `${sensorId}-humidity`,
                  name: `${sensorId} - Humidity`,
                  value: latestData.humidity,
                  unit: '%RH',
                  status,
                  trend,
                  timestamp: parseTimestamp(latestEntry.timestamp).getTime(),
                })
                
                readings.push({
                  id: `${sensorId}-voltage`,
                  name: `${sensorId} - Voltage`,
                  value: latestData.voltage,
                  unit: 'V',
                  status,
                  trend,
                  timestamp: parseTimestamp(latestEntry.timestamp).getTime(),
                })
              }
            }
          })
          
          callback(readings)
        } else {
          callback([])
        }
      } catch (error) {
        console.error('Error processing sensor readings:', error)
        if (onError) {
          onError(error as Error)
        }
      }
    },
    (error) => {
      if (onError) {
        onError(error)
      }
    }
  )

  return () => {
    off(deviceRef)
    unsubscribe()
  }
}

/**
 * Subscribe to time-series data for a specific device
 */
export const subscribeToTimeSeriesData = (
  deviceId: string,
  callback: (data: TimeSeriesDataPoint[]) => void,
  onError?: (error: Error) => void,
  limit: number = 60
) => {
  const deviceRef = ref(database, deviceId)
  
  const unsubscribe = onValue(
    deviceRef,
    (snapshot) => {
      try {
        const deviceData = snapshot.val()
        if (deviceData) {
          const allDataPoints: TimeSeriesDataPoint[] = []
          
          // Collect data from all sensors (all 16 BME sensors per device)
          Object.keys(deviceData).forEach((sensorId) => {
            if (sensorId.startsWith('BME')) {
              const sensorData = deviceData[sensorId]
              
              // Process heater profile entries (HP_301, HP_302, etc.)
              Object.keys(sensorData).forEach((hpId) => {
                const hpData = sensorData[hpId]
                if (hpData && typeof hpData === 'object') {
                  Object.keys(hpData).forEach((timestampStr) => {
                    const reading = hpData[timestampStr]
                    if (reading && typeof reading === 'object') {
                      const timestamp = parseTimestamp(timestampStr)
                      
                      allDataPoints.push({
                        timestamp: timestamp.getTime(),
                        time: timestamp.toISOString().substring(11, 16),
                        temperature: reading.temperature || 0,
                        humidity: reading.humidity || 0,
                        voltage: reading.voltage || 0,
                        adc: reading.gas_adc || 0,
                      })
                    }
                  })
                }
              })
            }
          })
          
          // Group by timestamp and average values
          const groupedByTime = new Map<string, TimeSeriesDataPoint[]>()
          
          allDataPoints.forEach((point) => {
            const timeKey = point.time
            if (!groupedByTime.has(timeKey)) {
              groupedByTime.set(timeKey, [])
            }
            groupedByTime.get(timeKey)!.push(point)
          })
          
          // Average values for each timestamp
          const averagedData: TimeSeriesDataPoint[] = Array.from(groupedByTime.entries())
            .map(([time, points]) => {
              const avg = points.reduce(
                (acc, point) => ({
                  temperature: acc.temperature + point.temperature,
                  humidity: acc.humidity + point.humidity,
                  voltage: acc.voltage + point.voltage,
                  adc: acc.adc + point.adc,
                }),
                { temperature: 0, humidity: 0, voltage: 0, adc: 0 }
              )
              
              return {
                time,
                timestamp: points[0].timestamp,
                temperature: avg.temperature / points.length,
                humidity: avg.humidity / points.length,
                voltage: avg.voltage / points.length,
                adc: avg.adc / points.length,
              }
            })
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-limit)
          
          callback(averagedData)
        } else {
          callback([])
        }
      } catch (error) {
        console.error('Error processing time-series data:', error)
        if (onError) {
          onError(error as Error)
        }
      }
    },
    (error) => {
      if (onError) {
        onError(error)
      }
    }
  )

  return () => {
    off(deviceRef)
    unsubscribe()
  }
}

/**
 * Subscribe to time-series data per sensor for a specific parameter
 */
export const subscribeToSensorTimeSeriesData = (
  deviceId: string,
  parameter: 'temperature' | 'humidity' | 'voltage' | 'adc',
  callback: (data: SensorTimeSeriesDataPoint[], sensorIds: string[]) => void,
  onError?: (error: Error) => void,
  limit: number = 60
) => {
  const deviceRef = ref(database, deviceId)
  
  const unsubscribe = onValue(
    deviceRef,
    (snapshot) => {
      try {
        const deviceData = snapshot.val()
        if (deviceData) {
          // Collect all sensor IDs
          const sensorIds: string[] = []
          Object.keys(deviceData).forEach((key) => {
            if (key.startsWith('BME')) {
              sensorIds.push(key)
            }
          })
          sensorIds.sort()
          
          // Collect all data points with timestamps
          const allDataPoints: Array<{ timestampStr: string; timestamp: number; sensorId: string; value: number }> = []
          
          sensorIds.forEach((sensorId) => {
            const sensorData = deviceData[sensorId]
            if (sensorData) {
              // Process heater profile entries (HP_301, HP_302, etc.)
              Object.keys(sensorData).forEach((hpId) => {
                const hpData = sensorData[hpId]
                if (hpData && typeof hpData === 'object') {
                  Object.keys(hpData).forEach((timestampStr) => {
                    const reading = hpData[timestampStr]
                    if (reading && typeof reading === 'object') {
                      const timestamp = parseTimestamp(timestampStr)
                      // Map parameter names: adc -> gas_adc, others are lowercase
                      const paramKey = parameter === 'adc' ? 'gas_adc' : parameter
                      const value = reading[paramKey] || 0
                      allDataPoints.push({
                        timestampStr,
                        timestamp: timestamp.getTime(),
                        sensorId,
                        value
                      })
                    }
                  })
                }
              })
            }
          })
          
          // Group by timestamp (exact match)
          const groupedByTimestamp = new Map<string, Map<string, number>>()
          
          allDataPoints.forEach(({ timestampStr, sensorId, value }) => {
            if (!groupedByTimestamp.has(timestampStr)) {
              groupedByTimestamp.set(timestampStr, new Map())
            }
            groupedByTimestamp.get(timestampStr)!.set(sensorId, value)
          })
          
          // Convert to array format
          const timeSeriesData: SensorTimeSeriesDataPoint[] = Array.from(groupedByTimestamp.entries())
            .map(([timestampStr, sensorValues]) => {
              const timestamp = parseTimestamp(timestampStr)
              const point: SensorTimeSeriesDataPoint = {
                time: timestamp.toISOString().substring(11, 16), // HH:MM format for display
                timestamp: timestamp.getTime(), // Use timestamp for proper ordering
                timestampStr: timestampStr // Store original timestamp string for formatting
              }
              
              // Add each sensor's value
              sensorIds.forEach(sensorId => {
                point[sensorId] = sensorValues.get(sensorId) || 0
              })
              
              return point
            })
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-limit)
          
          callback(timeSeriesData, sensorIds)
        } else {
          callback([], [])
        }
      } catch (error) {
        console.error('Error processing sensor time-series data:', error)
        if (onError) {
          onError(error as Error)
        }
      }
    },
    (error) => {
      if (onError) {
        onError(error)
      }
    }
  )

  return () => {
    off(deviceRef)
    unsubscribe()
  }
}

/**
 * Get all devices (one-time fetch)
 */
export const getAllDevices = async (): Promise<DeviceData[]> => {
  try {
    const rootRef = ref(database)
    const snapshot = await get(rootRef)
    
    if (snapshot.exists()) {
      const data = snapshot.val()
      return Object.keys(data)
        .filter(key => key.startsWith('Device_') && /^Device_\d+$/.test(key))
        .map((deviceId) => processDeviceData(deviceId, data[deviceId]))
        .sort((a, b) => {
          // Sort by device number (1-10)
          const numA = parseInt(a.id.replace('Device_', '')) || 0
          const numB = parseInt(b.id.replace('Device_', '')) || 0
          return numA - numB
        })
    }
    return []
  } catch (error) {
    console.error('Error fetching devices:', error)
    throw error
  }
}

