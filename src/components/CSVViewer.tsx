import { useState, useEffect } from 'react'
import { ref, get } from 'firebase/database'
import { database } from '../config/firebase'
import { parseTimestamp, formatTimestampForDisplay } from '../services/deviceService'
import './CSVViewer.css'

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

        // Calculate SeqNO and TotalTime
        const csvData: CSVDataRow[] = []
        let seqNo = 1
        let firstTimestamp: number | null = null

        allDataPoints.forEach((point) => {
          if (firstTimestamp === null) {
            firstTimestamp = point.timestampTime
          }

          const totalTimeSeconds = (point.timestampTime - firstTimestamp) / 1000
          const totalTimeFormatted = formatTotalTime(totalTimeSeconds)

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

    const headers = ['Device_ID', 'Sensor_ID', 'HP', 'TimeStamp', 'Temp', 'Hu', 'Vol', 'ADC', 'SeqNO', 'TotalTime']
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

