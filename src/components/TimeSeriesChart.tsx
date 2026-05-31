import { useState, useEffect, useMemo, useCallback, useTransition, memo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import {
  DeviceData,
  buildTimeSeriesFromDevice,
  getChartSeriesKey,
  SensorTimeSeriesDataPoint,
  formatTimestampForDisplay,
} from '../services/deviceService'
import { getSensorColor } from '../utils/sensorColors'
import './TimeSeriesChart.css'

interface TimeSeriesChartProps {
  device: DeviceData
  parameter: 'temperature' | 'humidity' | 'voltage' | 'adc'
  isFullData?: boolean
}

const CHART_LIMIT = 60

const parameterConfig = {
  temperature: { label: 'Temperature (°C)' },
  humidity: { label: 'Humidity (%RH)' },
  voltage: { label: 'Voltage (V)' },
  adc: { label: 'ADC' },
} as const

const CHART_GRID = '#2a3544'
const CHART_AXIS = '#9aa5b4'
const CHART_TOOLTIP_BG = '#151c26'
const CHART_TOOLTIP_BORDER = '#2a3544'

const calculateSamplingRate = (dataPoints: SensorTimeSeriesDataPoint[]): string => {
  if (dataPoints.length < 2) return 'N/A'
  const intervals: number[] = []
  for (let i = 1; i < dataPoints.length; i++) {
    const interval = (dataPoints[i].timestamp - dataPoints[i - 1].timestamp) / 1000
    if (interval > 0) intervals.push(interval)
  }
  if (intervals.length === 0) return 'N/A'
  const avg = intervals.reduce((sum, v) => sum + v, 0) / intervals.length
  if (avg < 60) return `${Math.round(avg)}s`
  if (avg < 3600) return `${Math.round(avg / 60)} min`
  return `${(avg / 3600).toFixed(1)} hr`
}

const calculateTimeRange = (dataPoints: SensorTimeSeriesDataPoint[]): string => {
  if (dataPoints.length < 2) return 'N/A'
  const range = (dataPoints[dataPoints.length - 1].timestamp - dataPoints[0].timestamp) / 1000
  if (range < 60) return `${Math.round(range)}s`
  if (range < 3600) return `${Math.round(range / 60)} min`
  return `${(range / 3600).toFixed(1)} hr`
}

interface ChartLinesProps {
  data: SensorTimeSeriesDataPoint[]
  sensorIds: string[]
  selectedSensors: Set<string>
  yLabel: string
}

const ChartLines = memo(({ data, sensorIds, selectedSensors, yLabel }: ChartLinesProps) => (
  <ResponsiveContainer width="100%" height={400}>
    <LineChart data={data} margin={{ top: 10, right: 24, left: 8, bottom: 10 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
      <XAxis
        dataKey="timestamp"
        type="number"
        domain={['dataMin', 'dataMax']}
        stroke={CHART_AXIS}
        tick={{ fill: CHART_AXIS, fontSize: 11, fontFamily: 'IBM Plex Mono, Consolas, monospace' }}
        interval={Math.max(0, Math.floor(data.length / 10))}
        tickFormatter={(value) => {
          const date = new Date(value)
          return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
        }}
      />
      <YAxis
        stroke={CHART_AXIS}
        tick={{ fill: CHART_AXIS, fontSize: 11, fontFamily: 'IBM Plex Mono, Consolas, monospace' }}
        domain={['auto', 'auto']}
        label={{ value: yLabel, angle: -90, position: 'insideLeft', style: { fill: CHART_AXIS, fontSize: 11, fontFamily: 'Source Sans 3, sans-serif' } }}
      />
      <Tooltip
        contentStyle={{
          backgroundColor: CHART_TOOLTIP_BG,
          border: `1px solid ${CHART_TOOLTIP_BORDER}`,
          borderRadius: '2px',
          color: '#eef2f7',
          fontFamily: 'IBM Plex Mono, Consolas, monospace',
          fontSize: '12px',
        }}
        labelStyle={{ color: '#9aa5b4', fontFamily: 'Source Sans 3, sans-serif', fontSize: '11px' }}
        labelFormatter={(value) => {
          const dataPoint = data.find((d) => d.timestamp === value)
          if (dataPoint?.timestampStr) return formatTimestampForDisplay(dataPoint.timestampStr)
          return new Date(value).toLocaleString()
        }}
      />
      {sensorIds.map((sensorId) =>
        selectedSensors.has(sensorId) ? (
          <Line
            key={sensorId}
            type="monotone"
            dataKey={sensorId}
            stroke={getSensorColor(sensorId)}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            name={sensorId}
          />
        ) : null
      )}
    </LineChart>
  </ResponsiveContainer>
))
ChartLines.displayName = 'ChartLines'

interface LegendItemProps {
  sensorId: string
  isSelected: boolean
  onToggle: (sensorId: string) => void
}

const LegendItem = memo(({ sensorId, isSelected, onToggle }: LegendItemProps) => {
  const color = getSensorColor(sensorId)
  return (
    <div
      role="button"
      tabIndex={0}
      className={`legend-item ${isSelected ? 'selected' : 'deselected'}`}
      onClick={() => onToggle(sensorId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle(sensorId)
        }
      }}
      style={{ color, cursor: 'pointer' }}
    >
      <span className="legend-icon" style={{ backgroundColor: color }} />
      <span className="legend-label">{sensorId}</span>
    </div>
  )
})
LegendItem.displayName = 'LegendItem'

const TimeSeriesChart = ({ device, parameter, isFullData = true }: TimeSeriesChartProps) => {
  const [selectedSensors, setSelectedSensors] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  const config = parameterConfig[parameter]

  const seriesKey = useMemo(
    () => getChartSeriesKey(device, parameter, CHART_LIMIT),
    [device, parameter]
  )

  const { data, sensorIds } = useMemo(
    () => buildTimeSeriesFromDevice(device, parameter, CHART_LIMIT),
    [seriesKey]
  )

  const sensorIdsKey = sensorIds.join(',')

  useEffect(() => {
    if (sensorIds.length > 0) {
      setSelectedSensors((prev) => (prev.size === 0 ? new Set(sensorIds) : prev))
    }
  }, [sensorIdsKey, sensorIds.length])

  const toggleSensor = useCallback((sensorId: string) => {
    startTransition(() => {
      setSelectedSensors((prev) => {
        const next = new Set(prev)
        if (next.has(sensorId)) next.delete(sensorId)
        else next.add(sensorId)
        return next
      })
    })
  }, [startTransition])

  const selectAll = useCallback(() => {
    startTransition(() => setSelectedSensors(new Set(sensorIds)))
  }, [sensorIds, startTransition])

  const deselectAll = useCallback(() => {
    startTransition(() => setSelectedSensors(new Set()))
  }, [startTransition])

  const chartInfo = useMemo(() => ({
    samplingRate: calculateSamplingRate(data),
    timeRange: calculateTimeRange(data),
  }), [seriesKey])

  if (!isFullData) {
    return (
      <div className="chart-loading">
        <p>Loading chart data…</p>
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
        <ChartLines
          data={data}
          sensorIds={sensorIds}
          selectedSensors={selectedSensors}
          yLabel={config.label}
        />
      </div>

      <div className="chart-legend-custom">
        <div className="legend-header">
          <div className="legend-title">Sensor Channels</div>
          <div className="legend-controls">
            <button type="button" className="legend-control-button" onClick={selectAll}>
              Select All
            </button>
            <button type="button" className="legend-control-button" onClick={deselectAll}>
              Deselect All
            </button>
          </div>
        </div>
        <div className="legend-items">
          {sensorIds.map((sensorId) => (
            <LegendItem
              key={sensorId}
              sensorId={sensorId}
              isSelected={selectedSensors.has(sensorId)}
              onToggle={toggleSensor}
            />
          ))}
        </div>
      </div>

      <div className="chart-info">
        <div className="info-item">
          <span className="info-label">Data Points</span>
          <span className="info-value">{data.length}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Sampling Rate</span>
          <span className="info-value">{chartInfo.samplingRate}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Time Range</span>
          <span className="info-value">{chartInfo.timeRange}</span>
        </div>
      </div>
    </div>
  )
}

export default TimeSeriesChart
