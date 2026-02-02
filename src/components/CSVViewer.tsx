import { useState, useEffect } from 'react'
import { ref, get } from 'firebase/database'
import { database } from '../config/firebase'
import { parseTimestamp, formatTimestampForDisplay, normalizeReading, type FirebaseRecord } from '../services/deviceService'
import './CSVViewer.css'

// HP + Step → Temperature lookup (from user-provided specification)
// All profiles have 10 steps; cycle wraps 1→2→...→10→1
const HP_STEP_TEMPERATURE_MAP: Record<string, Record<number, number>> = {
  '301': { 1: 100, 2: 100, 3: 200, 4: 200, 5: 200, 6: 200, 7: 320, 8: 320, 9: 320, 10: 320 },
  '321': { 1: 100, 2: 320, 3: 320, 4: 200, 5: 200, 6: 200, 7: 320, 8: 320, 9: 320, 10: 320 },
  '322': { 1: 100, 2: 320, 3: 320, 4: 200, 5: 200, 6: 200, 7: 320, 8: 320, 9: 320, 10: 320 },
  '323': { 1: 70, 2: 350, 3: 350, 4: 210, 5: 210, 6: 210, 7: 350, 8: 350, 9: 350, 10: 350 },
  '324': { 1: 70, 2: 350, 3: 350, 4: 210, 5: 210, 6: 210, 7: 350, 8: 350, 9: 350, 10: 350 },
  '331': { 1: 50, 2: 50, 3: 350, 4: 350, 5: 350, 6: 140, 7: 140, 8: 350, 9: 350, 10: 350 },
  '332': { 1: 50, 2: 50, 3: 350, 4: 350, 5: 350, 6: 140, 7: 140, 8: 350, 9: 350, 10: 350 },
  '354': { 1: 320, 2: 100, 3: 100, 4: 100, 5: 200, 6: 200, 7: 200, 8: 320, 9: 320, 10: 320 },
  '411': { 1: 100, 2: 320, 3: 170, 4: 320, 5: 240, 6: 240, 7: 240, 8: 320, 9: 320, 10: 320 },
  '412': { 1: 100, 2: 320, 3: 170, 4: 320, 5: 240, 6: 240, 7: 240, 8: 320, 9: 320, 10: 320 },
  '413': { 1: 70, 2: 350, 3: 163, 4: 350, 5: 256, 6: 256, 7: 256, 8: 350, 9: 350, 10: 350 },
  '414': { 1: 70, 2: 350, 3: 163, 4: 350, 5: 256, 6: 256, 7: 256, 8: 350, 9: 350, 10: 350 },
  '501': { 1: 210, 2: 265, 3: 265, 4: 320, 5: 320, 6: 265, 7: 210, 8: 155, 9: 100, 10: 155 },
  '502': { 1: 210, 2: 265, 3: 265, 4: 320, 5: 320, 6: 265, 7: 210, 8: 155, 9: 100, 10: 155 },
  '503': { 1: 210, 2: 280, 3: 280, 4: 350, 5: 350, 6: 280, 7: 210, 8: 140, 9: 70, 10: 140 },
  '504': { 1: 210, 2: 280, 3: 280, 4: 350, 5: 350, 6: 280, 7: 210, 8: 140, 9: 70, 10: 140 },
}

/**
 * Extract heater profile ID from HP string (e.g., "Hp_301" -> "301", "HP_001" -> "001")
 */
const extractProfileId = (hpString: string): string => {
  const normalized = hpString.replace(/^[Hh][Pp]_?/, '').trim()
  return normalized
}


/** Gap threshold in seconds - reset step to 1 after this gap */
const STEP_RESET_GAP_SECONDS = 3600 // 1 hour

/** Max steps per HP cycle - all profiles have 10 steps */
const MAX_STEPS = 10

/**
 * Get Heater_Temp from HP + Step lookup table
 */
const getHeaterTempForStep = (hpId: string, step: number): number => {
  const profileId = extractProfileId(hpId)
  const stepTemps = HP_STEP_TEMPERATURE_MAP[profileId]
  if (!stepTemps) return 0
  const temp = stepTemps[step]
  return temp ?? 0
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
  // All 11 Firebase parameters (do not ignore any)
  Duration: number
  GasADC: number
  GasRes: number
  Heater_Temp: number
  Hum: number
  Press: number
  Seq: number
  Status: string | number
  Step: number
  Temp: number
  Volt: number
  SeqNO: number
  TotalTime: string
  Delta_Sec?: number // Seconds since previous observation (same Sensor+HP); undefined for first obs
}

const CSVViewer = ({ deviceId, deviceName, onClose }: CSVViewerProps) => {
  const [allData, setAllData] = useState<CSVDataRow[]>([]) // Store all data
  const [filteredData, setFilteredData] = useState<CSVDataRow[]>([]) // Filtered data for display
  const [displayData, setDisplayData] = useState<CSVDataRow[]>([]) // Paginated data for display
  const [availableDates, setAvailableDates] = useState<string[]>([]) // Available dates from Firebase
  const [selectedDate, setSelectedDate] = useState<string>('') // Selected date filter
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedSensor, setSelectedSensor] = useState<string>('')
  const [selectedHP, setSelectedHP] = useState<string>('')
  const [selectedStep, setSelectedStep] = useState<string>('')
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: keyof CSVDataRow | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' })
  
  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    Device_ID: true,
    Sensor_ID: true,
    HP: true,
    TimeStamp: true,
    Delta_Sec: true,
    Duration: true,
    GasADC: true,
    GasRes: true,
    Heater_Temp: true,
    Hum: true,
    Press: true,
    Seq: true,
    Status: true,
    Step: true,
    Temp: true,
    Volt: true,
    SeqNO: true,
    TotalTime: true,
  })
  
  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [rowsPerPage, setRowsPerPage] = useState<number>(100)

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
          record: FirebaseRecord
        }> = []

        // Collect all data points from all sensors (all 11 Firebase columns)
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
                      const record = normalizeReading(reading as Record<string, unknown>)

                      allDataPoints.push({
                        sensorId,
                        hpId,
                        timestampStr,
                        timestampTime: timestamp.getTime(),
                        record,
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

        // Extract unique dates from timestamps (format: YYYY-MM-DD)
        const dateSet = new Set<string>()
        allDataPoints.forEach((point) => {
          const datePart = point.timestampStr.split('_')[0] // Extract YYYY-MM-DD part
          if (datePart) {
            dateSet.add(datePart)
          }
        })
        const dates = Array.from(dateSet).sort().reverse() // Sort descending (newest first)
        setAvailableDates(dates)
        
        // Set default selected date to the most recent date (only if not already set)
        if (dates.length > 0) {
          setSelectedDate((prev) => prev || dates[0])
        }

        // Track last step and last timestamp per sensor+HP for sequential step logic
        // Key: `${sensorId}_${hpId}`, Value: { lastStep: number, lastTimestamp: number }
        const sensorHpStepTracker: Record<string, { lastStep: number; lastTimestamp: number }> = {}
        
        // Track last HP per sensor to detect HP changes (reset step to 1)
        const sensorLastHp: Record<string, string> = {}

        // Calculate SeqNO, TotalTime, Step, Heater_Temp (Anomaly ignored)
        const csvData: CSVDataRow[] = []
        let seqNo = 1
        let firstTimestamp: number | null = null

        allDataPoints.forEach((point) => {
          if (firstTimestamp === null) {
            firstTimestamp = point.timestampTime
          }

          const totalTimeSeconds = (point.timestampTime - firstTimestamp) / 1000
          const totalTimeFormatted = formatTotalTime(totalTimeSeconds)

          const hpKey = `${point.sensorId}_${point.hpId}`
          const tracker = sensorHpStepTracker[hpKey]
          const lastHpForSensor = sensorLastHp[point.sensorId]

          // Determine if step should reset to 1:
          // 1. First observation for this sensor+HP
          // 2. HP changed for this sensor
          // 3. Gap > 1 hour since last observation
          const isFirstObs = !tracker
          const hpChanged = lastHpForSensor !== undefined && lastHpForSensor !== point.hpId
          const gapTooLarge = tracker && (point.timestampTime - tracker.lastTimestamp) / 1000 > STEP_RESET_GAP_SECONDS

          const shouldResetStep = isFirstObs || hpChanged || gapTooLarge

          // Calculate Step: sequential 1-10, wraps after 10
          let stepCount: number
          if (shouldResetStep) {
            stepCount = 1
          } else {
            // Next step in cycle: 1→2→...→10→1
            stepCount = (tracker!.lastStep % MAX_STEPS) + 1
          }

          // Heater_Temp: use Firebase value if present, else derive from HP+Step lookup
          const heaterTemp = point.record.Heater_Temp > 0
            ? point.record.Heater_Temp
            : getHeaterTempForStep(point.hpId, stepCount)

          // Step: use Firebase value if present, else use our calculated stepCount
          const stepValue = point.record.Step > 0 ? point.record.Step : stepCount

          // Delta_Sec: seconds since previous observation (same Sensor+HP)
          const deltaSec = tracker
            ? (point.timestampTime - tracker.lastTimestamp) / 1000
            : undefined

          // Update tracker
          sensorHpStepTracker[hpKey] = {
            lastStep: stepCount,
            lastTimestamp: point.timestampTime,
          }
          sensorLastHp[point.sensorId] = point.hpId

          // All 11 Firebase parameters - do not ignore any columns
          csvData.push({
            Device_ID: deviceId,
            Sensor_ID: point.sensorId,
            HP: point.hpId,
            TimeStamp: formatTimestampForDisplay(point.timestampStr),
            Delta_Sec: deltaSec,
            Duration: point.record.Duration,
            GasADC: point.record.GasADC,
            GasRes: point.record.GasRes,
            Heater_Temp: heaterTemp,
            Hum: point.record.Hum,
            Press: point.record.Press,
            Seq: point.record.Seq,
            Status: point.record.Status,
            Step: stepValue,
            Temp: point.record.Temp,
            Volt: point.record.Volt,
            SeqNO: seqNo++,
            TotalTime: totalTimeFormatted,
          })
        })

        setAllData(csvData)
        setIsLoading(false)
      } catch (err) {
        console.error('Error loading CSV data:', err)
        setError('Failed to load data')
        setIsLoading(false)
      }
    }

    loadData()
  }, [deviceId])

  // Get unique values for filters
  const uniqueSensors = Array.from(new Set(allData.map(row => row.Sensor_ID))).sort()
  const uniqueHPs = Array.from(new Set(allData.map(row => row.HP))).sort()
  const uniqueSteps = Array.from(new Set(allData.map(row => row.Step.toString()))).sort((a, b) => Number(a) - Number(b))

  // Filter and sort data
  useEffect(() => {
    let filtered = [...allData]

    // Date filter
    if (selectedDate) {
      filtered = filtered.filter((row) => {
        const timestampStr = row.TimeStamp
        const parts = timestampStr.split('-')
        if (parts.length >= 3) {
          const month = parts[0]?.padStart(2, '0') || ''
          const day = parts[1]?.padStart(2, '0') || ''
          const year = parts[2] || ''
          const formattedDate = `${year}-${month}-${day}`
          return formattedDate === selectedDate
        }
        return false
      })
    }

    // Sensor filter
    if (selectedSensor) {
      filtered = filtered.filter(row => row.Sensor_ID === selectedSensor)
    }

    // HP filter
    if (selectedHP) {
      filtered = filtered.filter(row => row.HP === selectedHP)
    }

    // Step filter
    if (selectedStep) {
      filtered = filtered.filter(row => row.Step.toString() === selectedStep)
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(row => 
        Object.values(row).some(value => 
          value?.toString().toLowerCase().includes(query)
        )
      )
    }

    // Sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key!]
        const bVal = b[sortConfig.key!]
        
        if (aVal === undefined || aVal === null) return 1
        if (bVal === undefined || bVal === null) return -1
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
        }
        
        const aStr = aVal.toString()
        const bStr = bVal.toString()
        
        if (sortConfig.direction === 'asc') {
          return aStr.localeCompare(bStr)
        } else {
          return bStr.localeCompare(aStr)
        }
      })
    }

    setFilteredData(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }, [selectedDate, allData, selectedSensor, selectedHP, selectedStep, searchQuery, sortConfig])

  // Pagination
  useEffect(() => {
    const startIndex = (currentPage - 1) * rowsPerPage
    const endIndex = startIndex + rowsPerPage
    setDisplayData(filteredData.slice(startIndex, endIndex))
  }, [filteredData, currentPage, rowsPerPage])

  const totalPages = Math.ceil(filteredData.length / rowsPerPage)

  const handleSort = (key: keyof CSVDataRow) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const toggleColumnVisibility = (column: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }))
  }

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

  const handleExport = (exportFiltered = false) => {
    const dataToExport = exportFiltered ? filteredData : allData
    if (dataToExport.length === 0) return

    // Only include visible columns
    const visibleHeaders = Object.entries(visibleColumns)
      .filter(([_, visible]) => visible)
      .map(([key, _]) => key)
    
    const csvRows: string[] = [visibleHeaders.join(',')]

    dataToExport.forEach((row) => {
      const csvRow: string[] = []
      visibleHeaders.forEach(header => {
        const value = row[header as keyof CSVDataRow]
        if (header === 'Delta_Sec') {
          csvRow.push(value !== undefined && value !== null ? Number(value).toFixed(2) : '')
        } else if (typeof value === 'number') {
          if (['Temp', 'Hum', 'Volt', 'GasADC', 'GasRes', 'Press'].includes(header)) {
            csvRow.push(value.toFixed(3))
          } else if (header === 'Heater_Temp') {
            csvRow.push(value.toFixed(1))
          } else {
            csvRow.push(value.toString())
          }
        } else {
          csvRow.push(value?.toString() || '')
        }
      })
      csvRows.push(csvRow.join(','))
    })

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    const filename = exportFiltered 
      ? `${deviceName.replace(/\s+/g, '_')}_filtered_${new Date().toISOString().split('T')[0]}.csv`
      : `${deviceName.replace(/\s+/g, '_')}_all_data_${new Date().toISOString().split('T')[0]}.csv`

    link.setAttribute('href', url)
    link.setAttribute('download', filename)
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
              onClick={() => handleExport(true)}
              disabled={filteredData.length === 0}
              title="Download filtered CSV file"
            >
              📥 Export Filtered
            </button>
            <button 
              className="csv-viewer-button csv-viewer-export" 
              onClick={() => handleExport(false)}
              disabled={allData.length === 0}
              title="Download all CSV data"
            >
              📥 Export All
            </button>
            <button className="csv-viewer-button csv-viewer-close" onClick={onClose}>
              ✕ Close
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        <div className="csv-viewer-filters">
          <div className="filter-row">
            <div className="filter-group">
              <label>Search:</label>
              <input
                type="text"
                className="filter-input"
                placeholder="Search all columns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label>Date:</label>
              <select
                className="filter-select"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                disabled={isLoading || availableDates.length === 0}
              >
                {availableDates.length === 0 ? (
                  <option value="">No dates available</option>
                ) : (
                  <>
                    <option value="">All Dates</option>
                    {availableDates.map((date) => {
                      const [year, month, day] = date.split('-')
                      const displayDate = `${month}/${day}/${year}`
                      return (
                        <option key={date} value={date}>
                          {displayDate}
                        </option>
                      )
                    })}
                  </>
                )}
              </select>
            </div>
            <div className="filter-group">
              <label>Sensor:</label>
              <select
                className="filter-select"
                value={selectedSensor}
                onChange={(e) => setSelectedSensor(e.target.value)}
              >
                <option value="">All Sensors</option>
                {uniqueSensors.map(sensor => (
                  <option key={sensor} value={sensor}>{sensor}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>HP:</label>
              <select
                className="filter-select"
                value={selectedHP}
                onChange={(e) => setSelectedHP(e.target.value)}
              >
                <option value="">All HP</option>
                {uniqueHPs.map(hp => (
                  <option key={hp} value={hp}>{hp}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Step:</label>
              <select
                className="filter-select"
                value={selectedStep}
                onChange={(e) => setSelectedStep(e.target.value)}
              >
                <option value="">All Steps</option>
                {uniqueSteps.map(step => (
                  <option key={step} value={step}>Step {step}</option>
                ))}
              </select>
            </div>
            <button 
              className="filter-clear-btn"
              onClick={() => {
                setSearchQuery('')
                setSelectedDate('')
                setSelectedSensor('')
                setSelectedHP('')
                setSelectedStep('')
              }}
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Column Visibility Toggle */}
        <div className="csv-viewer-column-toggle">
          <details>
            <summary>Toggle Columns</summary>
            <div className="column-checkboxes">
              {Object.keys(visibleColumns).map(column => (
                <label key={column} className="column-checkbox">
                  <input
                    type="checkbox"
                    checked={visibleColumns[column]}
                    onChange={() => toggleColumnVisibility(column)}
                  />
                  {column}
                </label>
              ))}
            </div>
          </details>
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
                    {visibleColumns.Device_ID && (
                      <th onClick={() => handleSort('Device_ID')} className="sortable">
                        Device_ID {sortConfig.key === 'Device_ID' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {visibleColumns.Sensor_ID && (
                      <th onClick={() => handleSort('Sensor_ID')} className="sortable">
                        Sensor_ID {sortConfig.key === 'Sensor_ID' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {visibleColumns.HP && (
                      <th onClick={() => handleSort('HP')} className="sortable">
                        HP {sortConfig.key === 'HP' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {visibleColumns.TimeStamp && (
                      <th onClick={() => handleSort('TimeStamp')} className="sortable">
                        TimeStamp {sortConfig.key === 'TimeStamp' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {visibleColumns.Delta_Sec && (
                      <th onClick={() => handleSort('Delta_Sec')} className="sortable">
                        Delta_Sec {sortConfig.key === 'Delta_Sec' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {visibleColumns.Duration && (
                      <th onClick={() => handleSort('Duration')} className="sortable">
                        Duration {sortConfig.key === 'Duration' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {visibleColumns.GasADC && (
                      <th onClick={() => handleSort('GasADC')} className="sortable">
                        GasADC {sortConfig.key === 'GasADC' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {visibleColumns.GasRes && (
                      <th onClick={() => handleSort('GasRes')} className="sortable">
                        GasRes {sortConfig.key === 'GasRes' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {visibleColumns.Heater_Temp && (
                      <th onClick={() => handleSort('Heater_Temp')} className="sortable">
                        Heater_Temp {sortConfig.key === 'Heater_Temp' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {visibleColumns.Hum && (
                      <th onClick={() => handleSort('Hum')} className="sortable">
                        Hum {sortConfig.key === 'Hum' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {visibleColumns.Press && (
                      <th onClick={() => handleSort('Press')} className="sortable">
                        Press {sortConfig.key === 'Press' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {visibleColumns.Seq && (
                      <th onClick={() => handleSort('Seq')} className="sortable">
                        Seq {sortConfig.key === 'Seq' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {visibleColumns.Status && (
                      <th onClick={() => handleSort('Status')} className="sortable">
                        Status {sortConfig.key === 'Status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {visibleColumns.Step && (
                      <th onClick={() => handleSort('Step')} className="sortable">
                        Step {sortConfig.key === 'Step' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {visibleColumns.Temp && (
                      <th onClick={() => handleSort('Temp')} className="sortable">
                        Temp {sortConfig.key === 'Temp' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {visibleColumns.Volt && (
                      <th onClick={() => handleSort('Volt')} className="sortable">
                        Volt {sortConfig.key === 'Volt' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {visibleColumns.SeqNO && (
                      <th onClick={() => handleSort('SeqNO')} className="sortable">
                        SeqNO {sortConfig.key === 'SeqNO' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {visibleColumns.TotalTime && (
                      <th onClick={() => handleSort('TotalTime')} className="sortable">
                        TotalTime {sortConfig.key === 'TotalTime' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {displayData.length === 0 ? (
                    <tr>
                      <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="no-data">
                        No data to display
                      </td>
                    </tr>
                  ) : (
                    displayData.map((row, index) => (
                      <tr key={index}>
                        {visibleColumns.Device_ID && <td>{row.Device_ID}</td>}
                        {visibleColumns.Sensor_ID && <td>{row.Sensor_ID}</td>}
                        {visibleColumns.HP && <td>{row.HP}</td>}
                        {visibleColumns.TimeStamp && <td>{row.TimeStamp}</td>}
                        {visibleColumns.Delta_Sec && (
                          <td>{row.Delta_Sec !== undefined ? row.Delta_Sec.toFixed(2) : '—'}</td>
                        )}
                        {visibleColumns.Duration && <td>{row.Duration}</td>}
                        {visibleColumns.GasADC && <td>{row.GasADC.toFixed(3)}</td>}
                        {visibleColumns.GasRes && <td>{row.GasRes.toFixed(3)}</td>}
                        {visibleColumns.Heater_Temp && <td>{row.Heater_Temp.toFixed(1)}</td>}
                        {visibleColumns.Hum && <td>{row.Hum.toFixed(3)}</td>}
                        {visibleColumns.Press && <td>{row.Press.toFixed(3)}</td>}
                        {visibleColumns.Seq && <td>{row.Seq}</td>}
                        {visibleColumns.Status && <td>{row.Status}</td>}
                        {visibleColumns.Step && <td>{row.Step}</td>}
                        {visibleColumns.Temp && <td>{row.Temp.toFixed(3)}</td>}
                        {visibleColumns.Volt && <td>{row.Volt.toFixed(3)}</td>}
                        {visibleColumns.SeqNO && <td>{row.SeqNO}</td>}
                        {visibleColumns.TotalTime && <td>{row.TotalTime}</td>}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="csv-viewer-footer">
                <div className="footer-info">
                  <span>Showing {displayData.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0} - {Math.min(currentPage * rowsPerPage, filteredData.length)} of {filteredData.length} records</span>
                  {filteredData.length !== allData.length && (
                    <span className="filter-indicator">(Filtered from {allData.length} total)</span>
                  )}
                </div>
                <div className="pagination-controls">
                  <label>
                    Rows per page:
                    <select
                      className="rows-per-page-select"
                      value={rowsPerPage}
                      onChange={(e) => {
                        setRowsPerPage(Number(e.target.value))
                        setCurrentPage(1)
                      }}
                    >
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                      <option value={500}>500</option>
                      <option value={1000}>1000</option>
                    </select>
                  </label>
                  <div className="pagination-buttons">
                    <button
                      className="pagination-btn"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      ««
                    </button>
                    <button
                      className="pagination-btn"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      «
                    </button>
                    <span className="page-info">
                      Page {currentPage} of {totalPages || 1}
                    </span>
                    <button
                      className="pagination-btn"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                    >
                      »
                    </button>
                    <button
                      className="pagination-btn"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages || totalPages === 0}
                    >
                      »»
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CSVViewer

