import { useState, useEffect } from 'react'
import { ref, get } from 'firebase/database'
import { database } from '../config/firebase'
import { parseTimestamp, formatTimestampForDisplay } from '../services/deviceService'
import './CSVViewer.css'

// Heater Profile Step Definition
interface HeaterProfileStep {
  startTime: number // seconds
  endTime: number // seconds
  temperature: number // °C
}

// Heater Profile Configuration
interface HeaterProfile {
  id: string
  totalDuration: number // seconds
  steps: HeaterProfileStep[]
}

// Heater Profile Definitions
const HEATER_PROFILES: Record<string, HeaterProfile> = {
  '001': {
    id: '001',
    totalDuration: 600.6,
    steps: [{ startTime: 0, endTime: 600.6, temperature: 320 }],
  },
  '301': {
    id: '301',
    totalDuration: 18.34,
    steps: [
      { startTime: 0, endTime: 6, temperature: 100 },
      { startTime: 6, endTime: 12, temperature: 200 },
      { startTime: 12, endTime: 18.34, temperature: 325 },
    ],
  },
  '321': {
    id: '321',
    totalDuration: 18.9,
    steps: [
      { startTime: 0, endTime: 6, temperature: 100 },
      { startTime: 6, endTime: 6, temperature: 325 }, // spike
      { startTime: 6, endTime: 12, temperature: 200 },
      { startTime: 12, endTime: 18.9, temperature: 325 },
    ],
  },
  '322': {
    id: '322',
    totalDuration: 27.44,
    steps: [
      { startTime: 0, endTime: 9, temperature: 100 },
      { startTime: 9, endTime: 9, temperature: 325 }, // spike
      { startTime: 9, endTime: 18, temperature: 200 },
      { startTime: 18, endTime: 27.44, temperature: 325 },
    ],
  },
  '323': {
    id: '323',
    totalDuration: 18.9,
    steps: [
      { startTime: 0, endTime: 6, temperature: 75 },
      { startTime: 6, endTime: 6, temperature: 350 }, // spike
      { startTime: 6, endTime: 12, temperature: 200 },
      { startTime: 12, endTime: 18.9, temperature: 325 },
    ],
  },
  '324': {
    id: '324',
    totalDuration: 27.44,
    steps: [
      { startTime: 0, endTime: 9, temperature: 75 },
      { startTime: 9, endTime: 9, temperature: 350 }, // spike
      { startTime: 9, endTime: 18, temperature: 200 },
      { startTime: 18, endTime: 27.44, temperature: 325 },
    ],
  },
  '331': {
    id: '331',
    totalDuration: 78.4,
    steps: [
      { startTime: 0, endTime: 20, temperature: 50 },
      { startTime: 20, endTime: 40, temperature: 350 },
      { startTime: 40, endTime: 60, temperature: 125 },
      { startTime: 60, endTime: 78.4, temperature: 350 },
    ],
  },
  '332': {
    id: '332',
    totalDuration: 112,
    steps: [
      { startTime: 0, endTime: 20, temperature: 50 },
      { startTime: 20, endTime: 60, temperature: 350 },
      { startTime: 60, endTime: 80, temperature: 125 },
      { startTime: 80, endTime: 112, temperature: 350 },
    ],
  },
  '354': {
    id: '354',
    totalDuration: 10.78,
    steps: [
      { startTime: 0, endTime: 2, temperature: 325 },
      { startTime: 2, endTime: 6, temperature: 100 },
      { startTime: 6, endTime: 8, temperature: 200 },
      { startTime: 8, endTime: 10.78, temperature: 325 },
    ],
  },
  '411': {
    id: '411',
    totalDuration: 24.64,
    steps: [
      { startTime: 0, endTime: 5, temperature: 100 },
      { startTime: 5, endTime: 8, temperature: 325 },
      { startTime: 8, endTime: 12, temperature: 150 },
      { startTime: 12, endTime: 15, temperature: 325 },
      { startTime: 15, endTime: 20, temperature: 200 },
      { startTime: 20, endTime: 24.64, temperature: 325 },
    ],
  },
  '412': {
    id: '412',
    totalDuration: 36.68,
    steps: [
      { startTime: 0, endTime: 8, temperature: 100 },
      { startTime: 8, endTime: 12, temperature: 325 },
      { startTime: 12, endTime: 20, temperature: 150 },
      { startTime: 20, endTime: 24, temperature: 325 },
      { startTime: 24, endTime: 30, temperature: 200 },
      { startTime: 30, endTime: 36.68, temperature: 325 },
    ],
  },
  '413': {
    id: '413',
    totalDuration: 24.64,
    steps: [
      { startTime: 0, endTime: 5, temperature: 75 },
      { startTime: 5, endTime: 8, temperature: 350 },
      { startTime: 8, endTime: 12, temperature: 150 },
      { startTime: 12, endTime: 16, temperature: 325 },
      { startTime: 16, endTime: 20, temperature: 200 },
      { startTime: 20, endTime: 24.64, temperature: 325 },
    ],
  },
  '414': {
    id: '414',
    totalDuration: 36.68,
    steps: [
      { startTime: 0, endTime: 8, temperature: 75 },
      { startTime: 8, endTime: 12, temperature: 350 },
      { startTime: 12, endTime: 20, temperature: 150 },
      { startTime: 20, endTime: 24, temperature: 325 },
      { startTime: 24, endTime: 30, temperature: 200 },
      { startTime: 30, endTime: 36.68, temperature: 325 },
    ],
  },
  '501': {
    id: '501',
    totalDuration: 26.88,
    steps: [
      { startTime: 0, endTime: 3, temperature: 200 },
      { startTime: 3, endTime: 6, temperature: 260 },
      { startTime: 6, endTime: 9, temperature: 320 },
      { startTime: 9, endTime: 12, temperature: 260 },
      { startTime: 12, endTime: 15, temperature: 200 },
      { startTime: 15, endTime: 20, temperature: 150 },
      { startTime: 20, endTime: 23, temperature: 100 },
      { startTime: 23, endTime: 26.88, temperature: 150 },
    ],
  },
  '502': {
    id: '502',
    totalDuration: 35.84,
    steps: [
      { startTime: 0, endTime: 5, temperature: 200 },
      { startTime: 5, endTime: 10, temperature: 260 },
      { startTime: 10, endTime: 15, temperature: 320 },
      { startTime: 15, endTime: 20, temperature: 260 },
      { startTime: 20, endTime: 25, temperature: 200 },
      { startTime: 25, endTime: 30, temperature: 150 },
      { startTime: 30, endTime: 35.84, temperature: 125 }, // 100-150°C average
    ],
  },
  '503': {
    id: '503',
    totalDuration: 26.88,
    steps: [
      { startTime: 0, endTime: 3, temperature: 200 },
      { startTime: 3, endTime: 6, temperature: 275 },
      { startTime: 6, endTime: 9, temperature: 350 },
      { startTime: 9, endTime: 12, temperature: 275 },
      { startTime: 12, endTime: 16, temperature: 200 },
      { startTime: 16, endTime: 20, temperature: 150 },
      { startTime: 20, endTime: 23, temperature: 100 },
      { startTime: 23, endTime: 26.88, temperature: 150 },
    ],
  },
  '504': {
    id: '504',
    totalDuration: 35.84,
    steps: [
      { startTime: 0, endTime: 5, temperature: 200 },
      { startTime: 5, endTime: 10, temperature: 275 },
      { startTime: 10, endTime: 15, temperature: 350 },
      { startTime: 15, endTime: 20, temperature: 275 },
      { startTime: 20, endTime: 25, temperature: 200 },
      { startTime: 25, endTime: 30, temperature: 150 },
      { startTime: 30, endTime: 35.84, temperature: 125 }, // 100-150°C average
    ],
  },
}

/**
 * Extract heater profile ID from HP string (e.g., "Hp_301" -> "301", "HP_001" -> "001")
 */
const extractProfileId = (hpString: string): string => {
  const normalized = hpString.replace(/^[Hh][Pp]_?/, '').trim()
  return normalized
}

/**
 * Get the minimum temperature for a heater profile
 */
const getMinTemperature = (hpId: string): number => {
  const profileId = extractProfileId(hpId)
  const profile = HEATER_PROFILES[profileId]

  if (!profile) {
    return 0
  }

  return Math.min(...profile.steps.map(step => step.temperature))
}

/**
 * Calculate heater temperature based on profile and elapsed time within cycle
 */
const calculateHeaterTemp = (hpId: string, elapsedSeconds: number): number => {
  const profileId = extractProfileId(hpId)
  const profile = HEATER_PROFILES[profileId]

  if (!profile) {
    console.warn(`Unknown heater profile: ${hpId} (extracted ID: ${profileId})`)
    return 0
  }

  // Handle cycles that repeat - use modulo to get position within current cycle
  const cyclePosition = elapsedSeconds % profile.totalDuration

  // Find the step that contains this time
  for (const step of profile.steps) {
    if (cyclePosition >= step.startTime && cyclePosition < step.endTime) {
      return step.temperature
    }
  }

  // If we're at the exact end time, use the last step's temperature
  if (cyclePosition >= profile.totalDuration) {
    const lastStep = profile.steps[profile.steps.length - 1]
    return lastStep.temperature
  }

  // Default to first step if somehow we don't match
  return profile.steps[0].temperature
}

interface CSVViewerProps {
  deviceId: string
  deviceName: string
  onClose: () => void
}

interface CSVDataRow {
  Device_ID: string
  Sensor_ID: string
  HP: string
  TimeStamp: string
  Temp: number
  Hu: number
  Vol: number
  ADC: number
  SeqNO: number
  TotalTime: string
  Heater_Temp: number
  Step: number
}

const CSVViewer = ({ deviceId, deviceName, onClose }: CSVViewerProps) => {
  const [data, setData] = useState<CSVDataRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const deviceRef = ref(database, deviceId)
        const snapshot = await get(deviceRef)

        if (!snapshot.exists()) {
          setError('No data available')
          setIsLoading(false)
          return
        }

        const deviceData = snapshot.val()
        const allDataPoints: Array<{
          sensorId: string
          hpId: string
          timestampStr: string
          timestampTime: number
          temperature: number
          humidity: number
          voltage: number
          adc: number
        }> = []

        // Collect all data points from all sensors
        Object.keys(deviceData).forEach((sensorId) => {
          if (sensorId.startsWith('BME')) {
            const sensorData = deviceData[sensorId]

            // Process heater profile entries (Hp_XXX or HP_XXX)
            Object.keys(sensorData).forEach((hpId) => {
              const isHeaterProfile = hpId.startsWith('Hp_') || hpId.startsWith('HP_')
              if (isHeaterProfile) {
                const hpData = sensorData[hpId]
                if (hpData && typeof hpData === 'object') {
                  Object.keys(hpData).forEach((timestampStr) => {
                    const reading = hpData[timestampStr]
                    if (reading && typeof reading === 'object') {
                      const timestamp = parseTimestamp(timestampStr)

                      allDataPoints.push({
                        sensorId,
                        hpId,
                        timestampStr,
                        timestampTime: timestamp.getTime(),
                        temperature: reading.temperature || 0,
                        humidity: reading.humidity || 0,
                        voltage: reading.voltage || 0,
                        adc: reading.gas_adc || 0,
                      })
                    }
                  })
                }
              }
            })
          }
        })

        // Sort by timestamp chronologically
        allDataPoints.sort((a, b) => a.timestampTime - b.timestampTime)

        // Track cycle information for each HP profile
        // Key: `${sensorId}_${hpId}`, Value: { cycleStartTime, lastTimestamp, profileDuration }
        const hpCycleInfo: Record<string, { cycleStartTime: number; lastTimestamp: number; profileDuration: number }> = {}

        // Track step count per sensor
        // Key: sensorId, Value: { stepCount, lastHeaterTemp, lastHpId }
        const sensorStepInfo: Record<string, { stepCount: number; lastHeaterTemp: number; lastHpId: string }> = {}

        // Calculate SeqNO, TotalTime, Heater_Temp, and Step
        const csvData: CSVDataRow[] = []
        let seqNo = 1
        let firstTimestamp: number | null = null

        allDataPoints.forEach((point) => {
          if (firstTimestamp === null) {
            firstTimestamp = point.timestampTime
          }

          const totalTimeSeconds = (point.timestampTime - firstTimestamp) / 1000
          const totalTimeFormatted = formatTotalTime(totalTimeSeconds)

          // Get profile duration for cycle detection
          const profileId = extractProfileId(point.hpId)
          const profile = HEATER_PROFILES[profileId]
          const profileDuration = profile ? profile.totalDuration : 0

          const hpKey = `${point.sensorId}_${point.hpId}`
          const cycleInfo = hpCycleInfo[hpKey]

          // Determine if this is a new cycle:
          // 1. First time seeing this HP
          // 2. HP changed from previous row
          // 3. Enough time has passed since last timestamp (gap > profile duration)
          const isNewCycle = !cycleInfo || 
            (csvData.length > 0 && csvData[csvData.length - 1].HP !== point.hpId) ||
            (cycleInfo && (point.timestampTime - cycleInfo.lastTimestamp) / 1000 > profileDuration * 1.5) // 1.5x threshold to account for small gaps

          if (isNewCycle) {
            hpCycleInfo[hpKey] = {
              cycleStartTime: point.timestampTime,
              lastTimestamp: point.timestampTime,
              profileDuration,
            }
          } else if (cycleInfo) {
            // Update last timestamp
            cycleInfo.lastTimestamp = point.timestampTime
          }

          // Calculate elapsed time within current HP cycle
          const cycleStartTime = hpCycleInfo[hpKey]?.cycleStartTime || point.timestampTime
          const elapsedInCycleSeconds = (point.timestampTime - cycleStartTime) / 1000

          // Calculate heater temperature based on HP profile and elapsed time
          const heaterTemp = calculateHeaterTemp(point.hpId, elapsedInCycleSeconds)

          // Calculate Step count for this sensor
          const stepInfo = sensorStepInfo[point.sensorId]
          const minTemp = getMinTemperature(point.hpId)
          
          let stepCount = 1
          if (stepInfo) {
            // Check if HP changed - reset step count
            if (stepInfo.lastHpId !== point.hpId) {
              stepCount = 1
            } else {
              // Check if temperature hit the lowest value (reset condition)
              // Reset if current temp is at or below minimum AND previous temp was above minimum
              if (heaterTemp <= minTemp && stepInfo.lastHeaterTemp > minTemp) {
                stepCount = 1
              } else {
                // Increment step count
                stepCount = stepInfo.stepCount + 1
              }
            }
          }

          // Update step tracking info
          sensorStepInfo[point.sensorId] = {
            stepCount,
            lastHeaterTemp: heaterTemp,
            lastHpId: point.hpId,
          }

          csvData.push({
            Device_ID: deviceId,
            Sensor_ID: point.sensorId,
            HP: point.hpId,
            TimeStamp: formatTimestampForDisplay(point.timestampStr),
            Temp: point.temperature,
            Hu: point.humidity,
            Vol: point.voltage,
            ADC: point.adc,
            SeqNO: seqNo++,
            TotalTime: totalTimeFormatted,
            Heater_Temp: heaterTemp,
            Step: stepCount,
          })
        })

        setData(csvData)
        setIsLoading(false)
      } catch (err) {
        console.error('Error loading CSV data:', err)
        setError('Failed to load data')
        setIsLoading(false)
      }
    }

    loadData()
  }, [deviceId])

  const formatTotalTime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const milliseconds = Math.floor((seconds % 1) * 1000)

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${secs}s`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s ${milliseconds}ms`
    }
  }

  const handleExport = () => {
    if (data.length === 0) return

    const headers = ['Device_ID', 'Sensor_ID', 'HP', 'TimeStamp', 'Temp', 'Hu', 'Vol', 'ADC', 'SeqNO', 'TotalTime', 'Heater_Temp', 'Step']
    const csvRows: string[] = [headers.join(',')]

    data.forEach((row) => {
      const csvRow = [
        row.Device_ID,
        row.Sensor_ID,
        row.HP,
        row.TimeStamp,
        row.Temp.toFixed(3),
        row.Hu.toFixed(3),
        row.Vol.toFixed(3),
        row.ADC.toFixed(3),
        row.SeqNO.toString(),
        row.TotalTime,
        row.Heater_Temp.toFixed(1),
        row.Step.toString(),
      ]
      csvRows.push(csvRow.join(','))
    })

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', `${deviceName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="csv-viewer-overlay" onClick={onClose}>
      <div className="csv-viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="csv-viewer-header">
          <h2 className="csv-viewer-title">CSV Data Viewer - {deviceName}</h2>
          <div className="csv-viewer-controls">
            <button 
              className="csv-viewer-button csv-viewer-export" 
              onClick={handleExport}
              disabled={data.length === 0}
              title="Download CSV file"
            >
              📥 Export CSV
            </button>
            <button className="csv-viewer-button csv-viewer-close" onClick={onClose}>
              ✕ Close
            </button>
          </div>
        </div>

        <div className="csv-viewer-content">
          {isLoading ? (
            <div className="csv-viewer-loading">
              <div className="loading-spinner"></div>
              <p>Loading data...</p>
            </div>
          ) : error ? (
            <div className="csv-viewer-error">
              <p>{error}</p>
            </div>
          ) : (
            <div className="csv-viewer-table-container">
              <table className="csv-viewer-table">
                <thead>
                  <tr>
                    <th>Device_ID</th>
                    <th>Sensor_ID</th>
                    <th>HP</th>
                    <th>TimeStamp</th>
                    <th>Temp</th>
                    <th>Hu</th>
                    <th>Vol</th>
                    <th>ADC</th>
                    <th>SeqNO</th>
                    <th>TotalTime</th>
                    <th>Heater_Temp</th>
                    <th>Step</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, index) => (
                    <tr key={index}>
                      <td>{row.Device_ID}</td>
                      <td>{row.Sensor_ID}</td>
                      <td>{row.HP}</td>
                      <td>{row.TimeStamp}</td>
                      <td>{row.Temp.toFixed(3)}</td>
                      <td>{row.Hu.toFixed(3)}</td>
                      <td>{row.Vol.toFixed(3)}</td>
                      <td>{row.ADC.toFixed(3)}</td>
                      <td>{row.SeqNO}</td>
                      <td>{row.TotalTime}</td>
                      <td>{row.Heater_Temp.toFixed(1)}</td>
                      <td>{row.Step}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="csv-viewer-footer">
                <p>Total Records: {data.length}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CSVViewer

