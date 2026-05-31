/** Muted scientific palette — 16 distinct series colors grouped by sensor block */
const SENSOR_COLOR_GROUPS = [
  ['#4a9fd4', '#3d8ec4', '#2e7db4', '#005ea2'],
  ['#5cb86a', '#4aaa58', '#3a9c46', '#2e8540'],
  ['#e6a700', '#d09500', '#ba8400', '#a47300'],
  ['#7b6fd6', '#6a5ec5', '#594db4', '#483ca3'],
] as const

export const getSensorColor = (sensorId: string): string => {
  const sensorNumStr = sensorId.replace('BME_', '').replace('BME', '').replace('_', '')
  const sensorNum = parseInt(sensorNumStr, 10) || 1
  const group = Math.floor((sensorNum - 1) / 4)
  const indexInGroup = (sensorNum - 1) % 4
  return SENSOR_COLOR_GROUPS[group]?.[indexInGroup] ?? '#9aa5b4'
}
