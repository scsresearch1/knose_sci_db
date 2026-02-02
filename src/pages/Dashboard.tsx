import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ref, get } from 'firebase/database'
import { database } from '../config/firebase'
import { parseTimestamp, normalizeReading, recordToSensorDataPoint } from '../services/deviceService'
import Header from '../components/Header'
import SensorGrid from '../components/SensorGrid'
import TimeSeriesChart from '../components/TimeSeriesChart'
import DeviceStatus from '../components/DeviceStatus'
import CSVViewer from '../components/CSVViewer'
import { subscribeToDevice, DeviceData } from '../services/deviceService'
import './Dashboard.css'

interface DashboardProps {
  onLogout: () => void
}

type ParameterType = 'temperature' | 'humidity' | 'voltage' | 'adc'

const Dashboard = ({ onLogout }: DashboardProps) => {
  const { deviceId } = useParams<{ deviceId: string }>()
  const navigate = useNavigate()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [device, setDevice] = useState<DeviceData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedParameter, setSelectedParameter] = useState<ParameterType>('temperature')
  const [showCSVViewer, setShowCSVViewer] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!deviceId) {
      setError('Device ID is required')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    // Subscribe to real-time updates for this device
    const unsubscribe = subscribeToDevice(
      deviceId,
      (deviceData) => {
        if (deviceData) {
          setDevice(deviceData)
          setError(null)
        } else {
          setError('Device not found')
        }
        setIsLoading(false)
      },
      (err: Error) => {
        console.error('Error loading device:', err)
        setError('Failed to load device data. Please check your Firebase connection.')
        setIsLoading(false)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [deviceId])

  const handleBackToDevices = () => {
    navigate('/devices')
  }

  const handleExport = async () => {
    if (!deviceId || !device) return

    try {
      // Fetch all device data
      const deviceRef = ref(database, deviceId)
      const snapshot = await get(deviceRef)
      
      if (!snapshot.exists()) {
        alert('No data available to export')
        return
      }

      const deviceData = snapshot.val()
      const csvRows: string[] = []
      
      // CSV Header
      csvRows.push('Device Name,Sensor ID,Timestamp,Temperature (°C),Humidity (%RH),Voltage (V),ADC')
      
      // Collect all data points from all sensors
      const allDataPoints: Array<{
        sensorId: string
        timestamp: string
        timestampTime: number
        temperature: number
        humidity: number
        voltage: number
        adc: number
      }> = []
      
      Object.keys(deviceData).forEach((sensorId) => {
        if (sensorId.startsWith('BME')) {
          const sensorData = deviceData[sensorId]
          
          // Process heater profile entries (HP_301, HP_302, etc.)
          // Each sensor can have multiple heater profiles
          Object.keys(sensorData).forEach((hpId) => {
            const hpData = sensorData[hpId]
            if (hpData && typeof hpData === 'object') {
              Object.keys(hpData).forEach((timestampStr) => {
                const reading = hpData[timestampStr]
                if (reading && typeof reading === 'object') {
                  const timestamp = parseTimestamp(timestampStr)
                  const data = recordToSensorDataPoint(normalizeReading(reading as Record<string, unknown>))
                  
                  allDataPoints.push({
                    sensorId,
                    timestamp: timestampStr,
                    timestampTime: timestamp.getTime(),
                    temperature: data.temperature,
                    humidity: data.humidity,
                    voltage: data.voltage,
                    adc: data.gas_adc,
                  })
                }
              })
            }
          })
        }
      })
      
      // Sort by timestamp, then by sensor ID
      allDataPoints.sort((a, b) => {
        if (a.timestampTime !== b.timestampTime) {
          return a.timestampTime - b.timestampTime
        }
        return a.sensorId.localeCompare(b.sensorId)
      })
      
      // Add data rows
      allDataPoints.forEach((point) => {
        const row = [
          device.name,
          point.sensorId,
          point.timestamp,
          point.temperature.toFixed(3),
          point.humidity.toFixed(3),
          point.voltage.toFixed(3),
          point.adc.toFixed(3)
        ]
        csvRows.push(row.join(','))
      })
      
      // Create CSV content
      const csvContent = csvRows.join('\n')
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      
      link.setAttribute('href', url)
      link.setAttribute('download', `${device.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error exporting data:', error)
      alert('Failed to export data. Please try again.')
    }
  }

  if (isLoading) {
    return (
      <div className="dashboard">
        <Header currentTime={currentTime} onLogout={onLogout} />
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading device data...</p>
        </div>
      </div>
    )
  }

  if (error || !device) {
    return (
      <div className="dashboard">
        <Header currentTime={currentTime} onLogout={onLogout} />
        <div className="error-container">
          <p className="error-message">{error || 'Device not found'}</p>
          <button className="back-button" onClick={handleBackToDevices}>
            Back to Devices
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <Header currentTime={currentTime} onLogout={onLogout} />
      
      <div className="dashboard-header-section">
        <button className="back-button" onClick={handleBackToDevices}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Devices
        </button>
        <h1 className="dashboard-device-title">{device.name} - {device.location}</h1>
      </div>

      <div className="parameter-selector-section">
        <h3 className="parameter-selector-title">Select Parameter</h3>
        <div className="parameter-buttons">
          <button
            className={`parameter-button ${selectedParameter === 'temperature' ? 'active' : ''}`}
            onClick={() => setSelectedParameter('temperature')}
          >
            Temperature (°C)
          </button>
          <button
            className={`parameter-button ${selectedParameter === 'humidity' ? 'active' : ''}`}
            onClick={() => setSelectedParameter('humidity')}
          >
            Humidity (%RH)
          </button>
          <button
            className={`parameter-button ${selectedParameter === 'voltage' ? 'active' : ''}`}
            onClick={() => setSelectedParameter('voltage')}
          >
            Voltage (V)
          </button>
          <button
            className={`parameter-button ${selectedParameter === 'adc' ? 'active' : ''}`}
            onClick={() => setSelectedParameter('adc')}
          >
            ADC
          </button>
        </div>
      </div>

      <div className="dashboard-main-content">
          <div className="dashboard-main">
            <div className="dashboard-section">
              <div className="section-header">
                <h2 className="section-title">Time-Series Data Visualization</h2>
                <div className="section-controls">
                  <button className="control-button" onClick={handleExport}>Export</button>
                </div>
              </div>
              <TimeSeriesChart deviceId={deviceId!} parameter={selectedParameter} />
            </div>

          <div className="dashboard-section">
            <div className="section-header">
              <h2 className="section-title">Device Status & Control</h2>
            </div>
            <DeviceStatus deviceId={deviceId!} onViewData={() => setShowCSVViewer(true)} />
          </div>
        </div>

          <div className="dashboard-sidebar">
            <div className="dashboard-section">
              <div className="section-header">
                <h2 className="section-title">Sensor Readings</h2>
              </div>
              <SensorGrid deviceId={deviceId!} parameter={selectedParameter} />
            </div>
          </div>
        </div>
      
      {showCSVViewer && (
        <CSVViewer
          deviceId={deviceId!}
          deviceName={device.name}
          onClose={() => setShowCSVViewer(false)}
        />
      )}
    </div>
  )
}

export default Dashboard

