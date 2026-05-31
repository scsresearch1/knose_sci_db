import { ref, onValue, off, get } from 'firebase/database'
import { database, DATABASE_URL } from '../config/firebase'

export interface SensorDataPoint {
  gas_adc: number
  humidity: number
  temperature: number
  voltage: number
}

/** Full Firebase record - all 11 parameters. Do not ignore any columns. */
export interface FirebaseRecord {
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
}

export interface SensorTimestamp {
  timestamp: string // Format: "2025-01-01_19-29-47"
  data: SensorDataPoint
}

export interface SensorData {
  id: string // BME_01 to BME_16 (16 sensors per device)
  readings: SensorTimestamp[]
  latestReading?: SensorDataPoint
  /** Heater profile with the most recent reading for this sensor */
  activeHeaterProfile?: string
}

export type ProcessDeviceMode = 'minimal' | 'full'

export interface DeviceData {
  id: string // Device_1, Device_2, etc. (auto-discovered from Firebase)
  name: string
  location: string
  status: 'online' | 'offline' | 'warning'
  sensors: SensorData[] // Should contain 16 sensors (BME_01 to BME_16)
  sensorCount: number
  lastUpdate: string
  /** Absolute last update timestamp (formatted), for UI display */
  lastUpdateTimestamp?: string
  /** Raw Firebase timestamp key for the latest reading */
  rawLatestTimestamp?: string
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
 * Normalize Firebase record to full FirebaseRecord (all 11 columns).
 * Handles both record formats:
 * - Format A: gas_adc, humidity, temperature, voltage
 * - Format B: Duration, GasADC, GasRes, Heater_Temp, Hum, Press, Seq, Status, Step, Temp, Volt
 */
export const normalizeReading = (reading: Record<string, unknown> | null | undefined): FirebaseRecord => {
  const def = (v: unknown) => (v !== undefined && v !== null ? (typeof v === 'number' ? v : Number(v) || 0) : 0)
  if (!reading || typeof reading !== 'object') {
    return {
      Duration: 0, GasADC: 0, GasRes: 0, Heater_Temp: 0, Hum: 0, Press: 0,
      Seq: 0, Status: '', Step: 0, Temp: 0, Volt: 0,
    }
  }
  return {
    Duration: def(reading.Duration),
    GasADC: def(reading.GasADC ?? reading.gas_adc),
    GasRes: def(reading.GasRes),
    Heater_Temp: def(reading.Heater_Temp),
    Hum: def(reading.Hum ?? reading.humidity),
    Press: def(reading.Press),
    Seq: def(reading.Seq),
    Status: reading.Status !== undefined && reading.Status !== null
      ? (typeof reading.Status === 'number' ? reading.Status : String(reading.Status))
      : '',
    Step: def(reading.Step),
    Temp: def(reading.Temp ?? reading.temperature),
    Volt: def(reading.Volt ?? reading.voltage),
  }
}

/** Get SensorDataPoint from FirebaseRecord (for backward compatibility) */
export const recordToSensorDataPoint = (r: FirebaseRecord): SensorDataPoint => ({
  gas_adc: r.GasADC,
  humidity: r.Hum,
  temperature: r.Temp,
  voltage: r.Volt,
})

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
 * Parse timestamp string to seconds since epoch with nanosecond precision
 * Format: "2026-01-01_15-13-29_679689000" (YYYY-MM-DD_HH-MM-SEC_NanoSEC)
 * Returns: seconds as float (e.g. 1735737209.679689000) for Delta_Sec nanosecond precision
 */
export const parseTimestampToSecondsWithNanos = (timestampStr: string): number => {
  const parts = timestampStr.split('_')
  if (parts.length < 2) return 0

  const [datePart, timePart, nanoPart] = parts
  if (!datePart || !timePart) return 0

  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute, second] = timePart.split('-').map(Number)

  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute) || isNaN(second)) {
    return 0
  }

  const date = new Date(year, month - 1, day, hour, minute, second)
  const secondsBase = date.getTime() / 1000
  const nanos = nanoPart ? parseInt(nanoPart, 10) || 0 : 0
  return secondsBase + nanos / 1e9
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
 * Structure: Device_X -> BME_XX -> HP_XXX -> timestamp -> { record }
 * - Devices auto-discovered: any Device_N (Device_1, Device_2, Device_5, etc.)
 * - Each device has BME sensors (BME_01 to BME_16)
 * - Each sensor runs heater profiles (Hp_301, Hp_322, etc.)
 * - Record format A: gas_adc, humidity, temperature, voltage
 * - Record format B: GasADC, Hum, Temp, Volt (normalized via normalizeReading)
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

/**
 * Lightweight hash for device data change detection.
 * Avoids JSON.stringify which can cause "Maximum call stack size exceeded" on large datasets.
 */
const getDeviceDataHash = (deviceData: FirebaseDeviceData | null | undefined): string => {
  if (!deviceData || typeof deviceData !== 'object') return ''
  try {
    const parts: string[] = []
    const sensorIds = Object.keys(deviceData).filter(k => k.startsWith('BME')).sort()
    for (const sensorId of sensorIds) {
      const sensorData = deviceData[sensorId]
      if (!sensorData || typeof sensorData !== 'object') continue
      const hpIds = Object.keys(sensorData).filter(k => k.startsWith('Hp_') || k.startsWith('HP_'))
      let lastTimestamp = ''
      for (const hpId of hpIds) {
        const hpData = sensorData[hpId]
        if (hpData && typeof hpData === 'object') {
          for (const ts of Object.keys(hpData)) {
            if (ts > lastTimestamp) lastTimestamp = ts
          }
        }
      }
      parts.push(`${sensorId}:${hpIds.length}:${lastTimestamp}`)
    }
    return parts.join('|')
  } catch {
    return Date.now().toString()
  }
}

const MAX_READINGS_PER_SENSOR = 5000

/**
 * Calculate sample rate from readings
 */
const calculateSampleRate = (readings: SensorTimestamp[]): number => {
  if (readings.length < 2) return 0

  const timestamps = readings.map(r => parseTimestamp(r.timestamp).getTime())
  const intervals: number[] = []

  for (let i = 1; i < timestamps.length; i++) {
    intervals.push((timestamps[i] - timestamps[i - 1]) / 1000)
  }

  const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
  return avgInterval > 0 ? 1 / avgInterval : 0
}

/** Discover device IDs without downloading nested sensor history (fast REST shallow query) */
export const fetchDeviceIds = async (): Promise<string[]> => {
  const url = `${DATABASE_URL}.json?shallow=true`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to discover devices (${res.status})`)
  }
  const data = await res.json()
  if (!data || typeof data !== 'object') return []
  return Object.keys(data)
    .filter((key) => /^Device_\d+$/.test(key))
    .sort((a, b) => {
      const numA = parseInt(a.replace('Device_', ''), 10) || 0
      const numB = parseInt(b.replace('Device_', ''), 10) || 0
      return numA - numB
    })
}

const buildDeviceResult = (
  deviceId: string,
  latestTimestamp: string,
  readingsAtLatestTimestamp: Map<string, SensorDataPoint>,
  sensors: SensorData[],
  totalReadings: number,
  uptime?: number
): DeviceData => {
  const readingsAtLatest = Array.from(readingsAtLatestTimestamp.values())
  const avgTemperature = readingsAtLatest.length > 0
    ? readingsAtLatest.reduce((sum, r) => sum + r.temperature, 0) / readingsAtLatest.length
    : 0
  const avgVoltage = readingsAtLatest.length > 0
    ? readingsAtLatest.reduce((sum, r) => sum + r.voltage, 0) / readingsAtLatest.length
    : 0

  const lastUpdateTime = latestTimestamp ? parseTimestamp(latestTimestamp) : new Date(0)
  const secondsSinceUpdate = (Date.now() - lastUpdateTime.getTime()) / 1000

  let status: 'online' | 'offline' | 'warning' = 'online'
  if (secondsSinceUpdate > 120) status = 'offline'
  else if (secondsSinceUpdate > 60) status = 'warning'

  const deviceNum = deviceId.replace('Device_', '')

  return {
    id: deviceId,
    name: `BME690 Sensor Array #${deviceNum.padStart(2, '0')}`,
    location: `Lab ${String.fromCharCode(64 + (parseInt(deviceNum) || 1) % 3 + 1)} - Chamber ${Math.ceil((parseInt(deviceNum) || 1) / 3)}`,
    status,
    sensors,
    sensorCount: sensors.length,
    lastUpdate: latestTimestamp ? formatLastUpdate(latestTimestamp) : 'Never',
    lastUpdateTimestamp: latestTimestamp ? formatTimestampForDisplay(latestTimestamp) : '',
    rawLatestTimestamp: latestTimestamp || undefined,
    temperature: avgTemperature,
    voltage: avgVoltage,
    vcc: avgVoltage * 1.84,
    uptime,
    dataPoints: totalReadings,
    sampleRate: sensors.length > 0 && sensors[0].readings.length > 1
      ? calculateSampleRate(sensors[0].readings)
      : 0,
  }
}

const createPlaceholderDevice = (deviceId: string): DeviceData =>
  buildDeviceResult(deviceId, '', new Map(), [], 0)

/** Fast path for device list — only normalizes readings at the latest timestamp */
const processDeviceDataMinimal = (deviceId: string, deviceData: FirebaseDeviceData): DeviceData => {
  let latestTimestamp = ''
  const sensorIdSet = new Set<string>()

  Object.keys(deviceData).forEach((sensorId) => {
    if (!sensorId.startsWith('BME')) return
    const sensorData = deviceData[sensorId]
    if (!sensorData || typeof sensorData !== 'object') return
    sensorIdSet.add(sensorId)

    Object.keys(sensorData).forEach((hpId) => {
      if (!hpId.startsWith('Hp_') && !hpId.startsWith('HP_')) return
      const hpData = sensorData[hpId]
      if (!hpData || typeof hpData !== 'object') return
      for (const timestampStr of Object.keys(hpData)) {
        if (timestampStr > latestTimestamp) latestTimestamp = timestampStr
      }
    })
  })

  const readingsAtLatestTimestamp = new Map<string, SensorDataPoint>()
  if (latestTimestamp) {
    Object.keys(deviceData).forEach((sensorId) => {
      if (!sensorId.startsWith('BME')) return
      const sensorData = deviceData[sensorId]
      if (!sensorData || typeof sensorData !== 'object') return

      Object.keys(sensorData).forEach((hpId) => {
        if (!hpId.startsWith('Hp_') && !hpId.startsWith('HP_')) return
        const hpData = sensorData[hpId]
        if (!hpData || typeof hpData !== 'object') return
        const reading = hpData[latestTimestamp]
        if (reading && typeof reading === 'object') {
          readingsAtLatestTimestamp.set(
            sensorId,
            recordToSensorDataPoint(normalizeReading(reading as Record<string, unknown>))
          )
        }
      })
    })
  }

  const sensors: SensorData[] = Array.from(sensorIdSet)
    .sort((a, b) => {
      const numA = parseInt(a.replace('BME_', '').replace('BME', '').replace('_', ''), 10) || 0
      const numB = parseInt(b.replace('BME_', '').replace('BME', '').replace('_', ''), 10) || 0
      return numA - numB
    })
    .map((id) => ({ id, readings: [] }))

  return buildDeviceResult(deviceId, latestTimestamp, readingsAtLatestTimestamp, sensors, 0)
}

const processDeviceData = (
  deviceId: string,
  deviceData: FirebaseDeviceData,
  options: { mode: ProcessDeviceMode } = { mode: 'full' }
): DeviceData => {
  if (options.mode === 'minimal') {
    return processDeviceDataMinimal(deviceId, deviceData)
  }

  const sensors: SensorData[] = []
  let latestTimestamp = ''
  let totalReadings = 0
  const readingsAtLatestTimestamp = new Map<string, SensorDataPoint>()
  const sensorLatest: Record<string, { timestamp: string; data: SensorDataPoint; hpId: string }> = {}

  Object.keys(deviceData).forEach((sensorId) => {
    if (!sensorId.startsWith('BME')) return

    const sensorReadings: SensorTimestamp[] = []
    const sensorData = deviceData[sensorId]
    if (!sensorData || typeof sensorData !== 'object') return

    Object.keys(sensorData).forEach((hpId) => {
      const isHeaterProfile = hpId.startsWith('Hp_') || hpId.startsWith('HP_')
      if (!isHeaterProfile) return

      const hpData = sensorData[hpId]
      if (!hpData || typeof hpData !== 'object') return

      Object.keys(hpData).forEach((timestampStr) => {
        const reading = hpData[timestampStr]
        if (!reading || typeof reading !== 'object') return

        const record = normalizeReading(reading as Record<string, unknown>)
        const dataPoint = recordToSensorDataPoint(record)
        totalReadings++

        if (timestampStr > latestTimestamp) {
          latestTimestamp = timestampStr
          readingsAtLatestTimestamp.clear()
        }
        if (timestampStr === latestTimestamp) {
          readingsAtLatestTimestamp.set(sensorId, dataPoint)
        }

        const prev = sensorLatest[sensorId]
        if (!prev || timestampStr > prev.timestamp) {
          sensorLatest[sensorId] = { timestamp: timestampStr, data: dataPoint, hpId }
        }

        sensorReadings.push({ timestamp: timestampStr, data: dataPoint })
      })
    })

    sensorReadings.sort((a, b) =>
      parseTimestamp(a.timestamp).getTime() - parseTimestamp(b.timestamp).getTime()
    )
    if (sensorReadings.length > MAX_READINGS_PER_SENSOR) {
      sensorReadings.splice(0, sensorReadings.length - MAX_READINGS_PER_SENSOR)
    }

    const latest = sensorLatest[sensorId]
    sensors.push({
      id: sensorId,
      readings: sensorReadings,
      latestReading: latest?.data,
      activeHeaterProfile: latest?.hpId ?? 'N/A',
    })
  })

  totalReadings = sensors.reduce((sum, s) => sum + s.readings.length, 0)

  sensors.sort((a, b) => {
    const numA = parseInt(a.id.replace('BME_', '').replace('BME', '').replace('_', ''), 10) || 0
    const numB = parseInt(b.id.replace('BME_', '').replace('BME', '').replace('_', ''), 10) || 0
    return numA - numB
  })

  let uptime: number | undefined
  if (sensors.length > 0) {
    const timestampSet = new Set<string>()
    for (const sensor of sensors) {
      for (const reading of sensor.readings) {
        if (reading.timestamp) timestampSet.add(reading.timestamp)
      }
    }
    const allTimestamps = Array.from(timestampSet)
    if (allTimestamps.length > 1) {
      allTimestamps.sort((a, b) =>
        parseTimestamp(a).getTime() - parseTimestamp(b).getTime()
      )
      const MAX_INTERVAL_SECONDS = 3600
      let totalUptime = 0
      for (let i = 0; i < allTimestamps.length - 1; i++) {
        const intervalSeconds =
          (parseTimestamp(allTimestamps[i + 1]).getTime() - parseTimestamp(allTimestamps[i]).getTime()) / 1000
        if (intervalSeconds > 0 && intervalSeconds <= MAX_INTERVAL_SECONDS) {
          totalUptime += intervalSeconds
        }
      }
      uptime = Math.floor(totalUptime)
    } else if (allTimestamps.length === 1) {
      uptime = 0
    }
  }

  return buildDeviceResult(deviceId, latestTimestamp, readingsAtLatestTimestamp, sensors, totalReadings, uptime)
}

/** Build chart data from already-processed device (avoids duplicate Firebase reads) */
/** Stable key for chart memoization — changes only when visible series data changes */
export const getChartSeriesKey = (
  device: DeviceData,
  parameter: 'temperature' | 'humidity' | 'voltage' | 'adc',
  limit: number = 60
): string => {
  const valueFromPoint = (data: SensorDataPoint): number => {
    switch (parameter) {
      case 'adc': return data.gas_adc
      case 'temperature': return data.temperature
      case 'humidity': return data.humidity
      default: return data.voltage
    }
  }
  const parts: string[] = [parameter]
  for (const sensor of device.sensors) {
    const tail = sensor.readings.slice(-limit)
    if (tail.length === 0) {
      parts.push(`${sensor.id}:0`)
      continue
    }
    const first = tail[0]
    const last = tail[tail.length - 1]
    parts.push(`${sensor.id}:${tail.length}:${first.timestamp}:${valueFromPoint(first.data)}:${last.timestamp}:${valueFromPoint(last.data)}`)
  }
  return parts.join('|')
}

export const buildTimeSeriesFromDevice = (
  device: DeviceData,
  parameter: 'temperature' | 'humidity' | 'voltage' | 'adc',
  limit: number = 60
): { data: SensorTimeSeriesDataPoint[]; sensorIds: string[] } => {
  const sensorIds = device.sensors.map((s) => s.id).sort()
  const groupedByTimestamp = new Map<string, Map<string, number>>()

  const valueFromPoint = (data: SensorDataPoint): number => {
    switch (parameter) {
      case 'adc': return data.gas_adc
      case 'temperature': return data.temperature
      case 'humidity': return data.humidity
      default: return data.voltage
    }
  }

  for (const sensor of device.sensors) {
    const tail = sensor.readings.slice(-limit)
    for (const reading of tail) {
      if (!groupedByTimestamp.has(reading.timestamp)) {
        groupedByTimestamp.set(reading.timestamp, new Map())
      }
      groupedByTimestamp.get(reading.timestamp)!.set(sensor.id, valueFromPoint(reading.data))
    }
  }

  const data: SensorTimeSeriesDataPoint[] = Array.from(groupedByTimestamp.entries())
    .map(([timestampStr, sensorValues]) => {
      const timestamp = parseTimestamp(timestampStr)
      const point: SensorTimeSeriesDataPoint = {
        time: timestamp.toISOString().substring(11, 16),
        timestamp: timestamp.getTime(),
        timestampStr,
      }
      for (const sensorId of sensorIds) {
        point[sensorId] = sensorValues.get(sensorId) ?? 0
      }
      return point
    })
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-limit)

  return { data, sensorIds }
}

/**
 * Shared Firebase listeners — one connection per scope, many subscribers.
 */
type DevicesCallback = (devices: DeviceData[]) => void
type DeviceCallback = (device: DeviceData | null) => void

let devicesListState: {
  callbacks: Set<DevicesCallback>
  devicesById: Map<string, DeviceData>
  deviceHashes: Record<string, string>
  listenerUnsubs: Map<string, () => void>
  discoveryInterval: ReturnType<typeof setInterval> | null
} | null = null

const deviceSubscriptions = new Map<string, {
  callbacks: Set<DeviceCallback>
  firebaseUnsub: (() => void) | null
  fullProcessTimer: ReturnType<typeof setTimeout> | null
  lastRaw: FirebaseDeviceData | null
}>()

const sortDevices = (devices: DeviceData[]): DeviceData[] =>
  [...devices].sort((a, b) => {
    const numA = parseInt(a.id.replace('Device_', ''), 10) || 0
    const numB = parseInt(b.id.replace('Device_', ''), 10) || 0
    return numA - numB
  })

let devicesListEmitScheduled = false

const emitDevicesList = () => {
  if (!devicesListState) return
  if (devicesListEmitScheduled) return
  devicesListEmitScheduled = true
  requestAnimationFrame(() => {
    devicesListEmitScheduled = false
    if (!devicesListState) return
    const devicesArray = sortDevices(Array.from(devicesListState.devicesById.values()))
    devicesListState.callbacks.forEach((cb) => cb(devicesArray))
  })
}

const attachDeviceListListener = (deviceId: string) => {
  if (!devicesListState || devicesListState.listenerUnsubs.has(deviceId)) return

  const deviceRef = ref(database, deviceId)
  const firebaseUnsub = onValue(deviceRef, (snapshot) => {
    if (!devicesListState) return

    if (!snapshot.exists()) {
      devicesListState.devicesById.delete(deviceId)
      delete devicesListState.deviceHashes[deviceId]
      emitDevicesList()
      return
    }

    const raw = snapshot.val() as FirebaseDeviceData
    const hash = getDeviceDataHash(raw)
    if (devicesListState.deviceHashes[deviceId] === hash) return
    devicesListState.deviceHashes[deviceId] = hash

    const processed = processDeviceData(deviceId, raw, { mode: 'minimal' })
    if (processed.rawLatestTimestamp) {
      const secondsSinceLatest =
        (Date.now() - parseTimestamp(processed.rawLatestTimestamp).getTime()) / 1000
      if (secondsSinceLatest < 300) processed.status = 'online'
    }

    devicesListState.devicesById.set(deviceId, processed)
    emitDevicesList()
  })

  devicesListState.listenerUnsubs.set(deviceId, () => {
    off(deviceRef)
    firebaseUnsub()
  })
}

const discoverAndAttachDevices = async (onError?: (error: Error) => void) => {
  if (!devicesListState) return
  try {
    const ids = await fetchDeviceIds()

    for (const id of ids) {
      if (!devicesListState.devicesById.has(id)) {
        devicesListState.devicesById.set(id, createPlaceholderDevice(id))
      }
    }

    for (const id of ids) {
      attachDeviceListListener(id)
    }

    for (const [id, unsub] of devicesListState.listenerUnsubs) {
      if (!ids.includes(id)) {
        unsub()
        devicesListState.listenerUnsubs.delete(id)
        devicesListState.devicesById.delete(id)
        delete devicesListState.deviceHashes[id]
      }
    }

    emitDevicesList()
  } catch (error) {
    console.error('Error discovering devices:', error)
    onError?.(error as Error)
  }
}

/**
 * Subscribe to device list (real-time, per-device listeners — no full DB download)
 */
export const subscribeToDevices = (
  callback: (devices: DeviceData[]) => void,
  onError?: (error: Error) => void
) => {
  if (!devicesListState) {
    devicesListState = {
      callbacks: new Set(),
      devicesById: new Map(),
      deviceHashes: {},
      listenerUnsubs: new Map(),
      discoveryInterval: null,
    }
    void discoverAndAttachDevices(onError)
    devicesListState.discoveryInterval = setInterval(
      () => { void discoverAndAttachDevices(onError) },
      30000
    )
  }

  devicesListState.callbacks.add(callback)
  emitDevicesList()

  return () => {
    if (!devicesListState) return
    devicesListState.callbacks.delete(callback)
    if (devicesListState.callbacks.size === 0) {
      devicesListState.listenerUnsubs.forEach((unsub) => unsub())
      devicesListState.listenerUnsubs.clear()
      if (devicesListState.discoveryInterval) {
        clearInterval(devicesListState.discoveryInterval)
      }
      devicesListState = null
    }
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
      return processDeviceData(deviceId, snapshot.val(), { mode: 'full' })
    }
    return null
  } catch (error) {
    console.error('Error fetching device:', error)
    throw error
  }
}

/**
 * Subscribe to real-time updates for a single device (shared listener per device)
 * Emits minimal data immediately, then full history after processing (non-blocking UI)
 */
export const subscribeToDevice = (
  deviceId: string,
  callback: (device: DeviceData | null) => void,
  onError?: (error: Error) => void
) => {
  let sub = deviceSubscriptions.get(deviceId)
  if (!sub) {
    sub = { callbacks: new Set(), firebaseUnsub: null, fullProcessTimer: null, lastRaw: null }
    deviceSubscriptions.set(deviceId, sub)

    const deviceRef = ref(database, deviceId)
    const firebaseUnsub = onValue(
      deviceRef,
      (snapshot) => {
        try {
          if (!snapshot.exists()) {
            sub!.lastRaw = null
            sub!.callbacks.forEach((cb) => cb(null))
            return
          }

          const raw = snapshot.val() as FirebaseDeviceData
          sub!.lastRaw = raw

          const quick = processDeviceData(deviceId, raw, { mode: 'minimal' })
          sub!.callbacks.forEach((cb) => cb(quick))

          if (sub!.fullProcessTimer) clearTimeout(sub!.fullProcessTimer)
          sub!.fullProcessTimer = setTimeout(() => {
            try {
              if (!sub!.lastRaw) return
              const full = processDeviceData(deviceId, sub!.lastRaw, { mode: 'full' })
              sub!.callbacks.forEach((cb) => cb(full))
            } catch (error) {
              console.error('Error processing full device data:', error)
              onError?.(error as Error)
            }
          }, 800)
        } catch (error) {
          console.error('Error processing device:', error)
          onError?.(error as Error)
        }
      },
      (error) => {
        console.error('Firebase error:', error)
        onError?.(error)
      }
    )
    sub.firebaseUnsub = () => {
      if (sub!.fullProcessTimer) clearTimeout(sub!.fullProcessTimer)
      off(deviceRef)
      firebaseUnsub()
    }
  }

  sub.callbacks.add(callback)

  return () => {
    const current = deviceSubscriptions.get(deviceId)
    if (!current) return
    current.callbacks.delete(callback)
    if (current.callbacks.size === 0) {
      current.firebaseUnsub?.()
      deviceSubscriptions.delete(deviceId)
    }
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
                      const record = normalizeReading(reading as Record<string, unknown>)
                      allTimestamps.push({
                        timestamp: timestampStr,
                        data: recordToSensorDataPoint(record),
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
                      const data = recordToSensorDataPoint(normalizeReading(reading as Record<string, unknown>))
                      allDataPoints.push({
                        timestamp: timestamp.getTime(),
                        time: timestamp.toISOString().substring(11, 16),
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
                      const data = recordToSensorDataPoint(normalizeReading(reading as Record<string, unknown>))
                      const value = parameter === 'adc' ? data.gas_adc
                        : parameter === 'temperature' ? data.temperature
                        : parameter === 'humidity' ? data.humidity
                        : data.voltage
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
        .map((deviceId) => processDeviceData(deviceId, data[deviceId], { mode: 'minimal' }))
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

