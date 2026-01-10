// Script to verify timestamps, step counts, and heater profile mappings
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, get } from 'firebase/database'

const firebaseConfig = {
  databaseURL: 'https://knose-e1959-default-rtdb.firebaseio.com/'
}

const app = initializeApp(firebaseConfig)
const database = getDatabase(app)

// Heater Profile Definitions (all configured profiles)
const HEATER_PROFILES = {
  '301': {
    totalDuration: 18,
    timeStepMap: [
      { time: 0, step: 1, temp: 100 },
      { time: 6, step: 2, temp: 100 },
      { time: 7, step: 3, temp: 200 },
      { time: 9, step: 4, temp: 200 },
      { time: 11, step: 5, temp: 200 },
      { time: 12, step: 6, temp: 200 },
      { time: 13, step: 7, temp: 320 },
      { time: 15, step: 8, temp: 320 },
      { time: 17, step: 9, temp: 320 },
      { time: 18, step: 10, temp: 320 },
    ],
  },
  '321': {
    totalDuration: 18,
    timeStepMap: [
      { time: 0, step: 1, temp: 100 },
      { time: 6, step: 2, temp: 100 },
      { time: 6.5, step: 3, temp: 320 },
      { time: 6.8, step: 4, temp: 320 },
      { time: 7.2, step: 5, temp: 200 },
      { time: 10, step: 6, temp: 200 },
      { time: 13, step: 7, temp: 200 },
      { time: 14, step: 8, temp: 320 },
      { time: 16, step: 9, temp: 320 },
      { time: 17.5, step: 10, temp: 320 },
      { time: 18, step: 11, temp: 320 },
    ],
  },
  '322': {
    totalDuration: 26,
    timeStepMap: [
      { time: 0, step: 1, temp: 100 },
      { time: 9, step: 2, temp: 100 },
      { time: 9.5, step: 3, temp: 320 },
      { time: 9.8, step: 4, temp: 320 },
      { time: 10.2, step: 5, temp: 200 },
      { time: 14, step: 6, temp: 200 },
      { time: 18, step: 7, temp: 200 },
      { time: 19, step: 8, temp: 320 },
      { time: 22, step: 9, temp: 320 },
      { time: 25, step: 10, temp: 320 },
      { time: 26, step: 11, temp: 320 },
    ],
  },
  '323': {
    totalDuration: 18,
    timeStepMap: [
      { time: 0, step: 1, temp: 70 },
      { time: 6, step: 2, temp: 70 },
      { time: 6.3, step: 3, temp: 350 },
      { time: 6.6, step: 4, temp: 350 },
      { time: 7, step: 5, temp: 210 },
      { time: 10, step: 6, temp: 210 },
      { time: 13, step: 7, temp: 210 },
      { time: 14, step: 8, temp: 350 },
      { time: 16, step: 9, temp: 350 },
      { time: 17.5, step: 10, temp: 350 },
      { time: 18, step: 11, temp: 350 },
    ],
  },
  '324': {
    totalDuration: 26,
    timeStepMap: [
      { time: 0, step: 1, temp: 70 },
      { time: 9, step: 2, temp: 70 },
      { time: 9.3, step: 3, temp: 350 },
      { time: 9.7, step: 4, temp: 350 },
      { time: 10.1, step: 5, temp: 210 },
      { time: 14, step: 6, temp: 210 },
      { time: 18, step: 7, temp: 210 },
      { time: 19, step: 8, temp: 350 },
      { time: 22, step: 9, temp: 350 },
      { time: 25, step: 10, temp: 350 },
      { time: 26, step: 11, temp: 350 },
    ],
  },
  '331': {
    totalDuration: 75,
    timeStepMap: [
      { time: 0, step: 1, temp: 50 },
      { time: 10, step: 2, temp: 50 },
      { time: 20, step: 3, temp: 50 },
      { time: 20.5, step: 4, temp: 350 },
      { time: 40, step: 5, temp: 350 },
      { time: 50, step: 6, temp: 140 },
      { time: 60, step: 7, temp: 140 },
      { time: 60.5, step: 8, temp: 350 },
      { time: 75, step: 9, temp: 350 },
    ],
  },
  '332': {
    totalDuration: 110,
    timeStepMap: [
      { time: 0, step: 1, temp: 50 },
      { time: 15, step: 2, temp: 50 },
      { time: 30, step: 3, temp: 50 },
      { time: 30.5, step: 4, temp: 350 },
      { time: 60, step: 5, temp: 350 },
      { time: 70, step: 6, temp: 140 },
      { time: 85, step: 7, temp: 140 },
      { time: 85.5, step: 8, temp: 350 },
      { time: 110, step: 9, temp: 350 },
    ],
  },
  '354': {
    totalDuration: 10,
    timeStepMap: [
      { time: 0, step: 1, temp: 320 },
      { time: 1, step: 2, temp: 320 },
      { time: 1.5, step: 3, temp: 100 },
      { time: 3, step: 4, temp: 100 },
      { time: 6.5, step: 5, temp: 100 },
      { time: 7, step: 6, temp: 200 },
      { time: 8, step: 7, temp: 200 },
      { time: 9, step: 8, temp: 320 },
      { time: 9.5, step: 9, temp: 320 },
      { time: 10, step: 10, temp: 320 },
    ],
  },
  '411': {
    totalDuration: 23,
    timeStepMap: [
      { time: 0, step: 1, temp: 100 },
      { time: 6, step: 2, temp: 100 },
      { time: 6.3, step: 3, temp: 320 },
      { time: 6.8, step: 4, temp: 170 },
      { time: 13, step: 5, temp: 170 },
      { time: 13.3, step: 6, temp: 320 },
      { time: 14, step: 7, temp: 240 },
      { time: 18, step: 8, temp: 240 },
      { time: 19, step: 9, temp: 320 },
      { time: 21, step: 10, temp: 320 },
      { time: 23, step: 11, temp: 320 },
    ],
  },
  '412': {
    totalDuration: 36,
    timeStepMap: [
      { time: 0, step: 1, temp: 100 },
      { time: 9, step: 2, temp: 100 },
      { time: 9.3, step: 3, temp: 320 },
      { time: 9.8, step: 4, temp: 170 },
      { time: 18, step: 5, temp: 170 },
      { time: 18.3, step: 6, temp: 320 },
      { time: 19, step: 7, temp: 240 },
      { time: 23, step: 8, temp: 240 },
      { time: 27, step: 9, temp: 240 },
      { time: 28, step: 10, temp: 320 },
      { time: 32, step: 11, temp: 320 },
      { time: 36, step: 12, temp: 320 },
    ],
  },
  '413': {
    totalDuration: 23,
    timeStepMap: [
      { time: 0, step: 1, temp: 70 },
      { time: 6, step: 2, temp: 70 },
      { time: 6.3, step: 3, temp: 350 },
      { time: 6.8, step: 4, temp: 160 },
      { time: 13, step: 5, temp: 160 },
      { time: 13.3, step: 6, temp: 350 },
      { time: 14, step: 7, temp: 255 },
      { time: 18, step: 8, temp: 255 },
      { time: 19, step: 9, temp: 350 },
      { time: 21, step: 10, temp: 350 },
      { time: 23, step: 11, temp: 350 },
    ],
  },
  '414': {
    totalDuration: 36,
    timeStepMap: [
      { time: 0, step: 1, temp: 70 },
      { time: 9, step: 2, temp: 70 },
      { time: 9.3, step: 3, temp: 350 },
      { time: 9.7, step: 4, temp: 160 },
      { time: 18, step: 5, temp: 160 },
      { time: 18.5, step: 6, temp: 350 },
      { time: 19, step: 7, temp: 255 },
      { time: 23, step: 8, temp: 255 },
      { time: 28, step: 9, temp: 255 },
      { time: 29, step: 10, temp: 350 },
      { time: 32, step: 11, temp: 350 },
      { time: 36, step: 12, temp: 350 },
    ],
  },
  '501': {
    totalDuration: 26,
    timeStepMap: [
      { time: 0, step: 1, temp: 210 },
      { time: 4, step: 2, temp: 210 },
      { time: 4.5, step: 3, temp: 260 },
      { time: 7, step: 4, temp: 260 },
      { time: 7.5, step: 5, temp: 320 },
      { time: 10, step: 6, temp: 320 },
      { time: 14, step: 7, temp: 260 },
      { time: 18, step: 8, temp: 210 },
      { time: 21, step: 9, temp: 150 },
      { time: 24, step: 10, temp: 100 },
      { time: 26, step: 11, temp: 150 },
    ],
  },
  '502': {
    totalDuration: 35,
    timeStepMap: [
      { time: 0, step: 1, temp: 210 },
      { time: 5, step: 2, temp: 210 },
      { time: 5.5, step: 3, temp: 260 },
      { time: 9, step: 4, temp: 260 },
      { time: 9.5, step: 5, temp: 320 },
      { time: 13, step: 6, temp: 320 },
      { time: 17, step: 7, temp: 260 },
      { time: 22, step: 8, temp: 210 },
      { time: 27, step: 9, temp: 150 },
      { time: 31, step: 10, temp: 100 },
      { time: 35, step: 11, temp: 150 },
    ],
  },
  '503': {
    totalDuration: 26,
    timeStepMap: [
      { time: 0, step: 1, temp: 210 },
      { time: 4, step: 2, temp: 210 },
      { time: 4.5, step: 3, temp: 280 },
      { time: 7, step: 4, temp: 280 },
      { time: 7.5, step: 5, temp: 350 },
      { time: 10, step: 6, temp: 350 },
      { time: 13, step: 7, temp: 280 },
      { time: 17, step: 8, temp: 210 },
      { time: 21, step: 9, temp: 140 },
      { time: 24, step: 10, temp: 70 },
      { time: 26, step: 11, temp: 140 },
    ],
  },
  '504': {
    totalDuration: 35,
    timeStepMap: [
      { time: 0, step: 1, temp: 210 },
      { time: 5, step: 2, temp: 210 },
      { time: 5.5, step: 3, temp: 280 },
      { time: 9, step: 4, temp: 280 },
      { time: 9.5, step: 5, temp: 350 },
      { time: 13, step: 6, temp: 350 },
      { time: 17, step: 7, temp: 280 },
      { time: 21, step: 8, temp: 210 },
      { time: 25, step: 9, temp: 140 },
      { time: 30, step: 10, temp: 70 },
      { time: 35, step: 11, temp: 140 },
    ],
  },
}

function parseTimestamp(timestampStr) {
  const parts = timestampStr.split('_')
  if (parts.length < 2) return null
  
  const [datePart, timePart] = parts
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute, second] = timePart.split('-').map(Number)
  
  return new Date(year, month - 1, day, hour, minute, second)
}

function extractProfileId(hpString) {
  return hpString.replace(/^[Hh][Pp]_?/, '').trim()
}

function normalizeStepMapping(timeStepMap) {
  if (!timeStepMap || timeStepMap.length === 0) {
    return { normalizedMap: [], anomalies: [] }
  }

  const sortedMap = [...timeStepMap].sort((a, b) => a.step - b.step)
  const anomalies = []
  const stepSet = new Set(sortedMap.map(m => m.step))
  
  if (sortedMap.length > 0) {
    const minStep = sortedMap[0].step
    const maxStep = sortedMap[sortedMap.length - 1].step
    
    for (let stepNum = minStep; stepNum <= maxStep; stepNum++) {
      if (!stepSet.has(stepNum)) {
        anomalies.push(stepNum)
      }
    }
  }

  const normalizedMap = sortedMap.map((mapping, index) => ({
    time: mapping.time,
    step: index + 1,
    temp: mapping.temp,
    originalStep: mapping.step,
    isAnomaly: anomalies.includes(mapping.step),
  }))

  return { normalizedMap, anomalies }
}

function calculateStepAndTempFromTime(hpId, elapsedSeconds, profile) {
  if (!profile || !profile.timeStepMap || profile.timeStepMap.length === 0) {
    return { step: 1, temp: 0, isAnomaly: false }
  }

  const cyclePosition = elapsedSeconds % profile.totalDuration
  const { normalizedMap } = normalizeStepMapping(profile.timeStepMap)
  
  let selectedMapping = normalizedMap[0]
  
  for (let i = normalizedMap.length - 1; i >= 0; i--) {
    if (normalizedMap[i].time <= cyclePosition) {
      selectedMapping = normalizedMap[i]
      break
    }
  }
  
  return { 
    step: selectedMapping.step,
    temp: selectedMapping.temp,
    isAnomaly: selectedMapping.isAnomaly
  }
}

async function verifyStepsAndTimestamps(deviceId = 'Device_4') {
  try {
    console.log(`\n=== Verifying Steps, Timestamps, and Heater Profiles for ${deviceId} ===\n`)
    
    const deviceRef = ref(database, deviceId)
    const snapshot = await get(deviceRef)

    if (!snapshot.exists()) {
      console.log(`Device ${deviceId} not found`)
      return
    }

    const deviceData = snapshot.val()
    const allDataPoints = []

    // Collect all data points
    Object.keys(deviceData).forEach((sensorId) => {
      if (sensorId.startsWith('BME')) {
        const sensorData = deviceData[sensorId]
        
        Object.keys(sensorData).forEach((hpId) => {
          const isHeaterProfile = hpId.startsWith('Hp_') || hpId.startsWith('HP_')
          if (isHeaterProfile) {
            const hpData = sensorData[hpId]
            if (hpData && typeof hpData === 'object') {
              Object.keys(hpData).forEach((timestampStr) => {
                const reading = hpData[timestampStr]
                if (reading && typeof reading === 'object') {
                  const timestamp = parseTimestamp(timestampStr)
                  if (timestamp) {
                    allDataPoints.push({
                      sensorId,
                      hpId,
                      timestampStr,
                      timestamp: timestamp.getTime(),
                    })
                  }
                }
              })
            }
          }
        })
      }
    })

    // Sort by timestamp
    allDataPoints.sort((a, b) => a.timestamp - b.timestamp)

    if (allDataPoints.length === 0) {
      console.log('No data points found')
      return
    }

    // Group by sensor and HP
    const groupedData = {}
    allDataPoints.forEach(point => {
      const key = `${point.sensorId}_${point.hpId}`
      if (!groupedData[key]) {
        groupedData[key] = []
      }
      groupedData[key].push(point)
    })

    console.log(`Total data points: ${allDataPoints.length}`)
    console.log(`Unique sensor+HP combinations: ${Object.keys(groupedData).length}\n`)

    // Verify each sensor+HP combination
    let totalIssues = 0
    let totalAnomalies = 0

    Object.keys(groupedData).forEach(key => {
      const parts = key.split('_')
      // Key format: "BME_01_Hp_301" -> parts: ["BME", "01", "Hp", "301"]
      const sensorId = parts[0] + '_' + parts[1] // "BME_01"
      const hpId = parts.slice(2).join('_') // "Hp_301" or "HP_301"
      const points = groupedData[key]
      const profileId = extractProfileId(hpId)
      const profile = HEATER_PROFILES[profileId]

      if (!profile) {
        console.log(`⚠️  ${key}: Profile ${profileId} not found in verification data`)
        return
      }

      console.log(`\n--- ${key} (${points.length} data points) ---`)
      
      // Find cycle start (first timestamp)
      const firstTimestamp = points[0].timestamp
      let cycleStart = firstTimestamp
      let currentCycle = 1
      const issues = []
      let anomalyCount = 0

      points.forEach((point, index) => {
        const elapsedSeconds = (point.timestamp - cycleStart) / 1000
        
        // Check if we need to reset cycle
        if (elapsedSeconds >= profile.totalDuration && profile.totalDuration > 0) {
          const cyclesCompleted = Math.floor(elapsedSeconds / profile.totalDuration)
          cycleStart = firstTimestamp + (cyclesCompleted * profile.totalDuration * 1000)
          currentCycle = cyclesCompleted + 1
        }

        const elapsedInCycle = (point.timestamp - cycleStart) / 1000
        const { step, temp, isAnomaly } = calculateStepAndTempFromTime(hpId, elapsedInCycle, profile)

        if (isAnomaly) {
          anomalyCount++
        }

        // Verify step is within expected range
        const maxStep = profile.timeStepMap.length
        if (step > maxStep) {
          issues.push({
            index: index + 1,
            timestamp: point.timestampStr,
            elapsed: elapsedInCycle.toFixed(2),
            calculatedStep: step,
            maxExpectedStep: maxStep,
            cycle: currentCycle,
          })
        }

        // Show first 5 and last 5 data points
        if (index < 5 || index >= points.length - 5) {
          const date = new Date(point.timestamp)
          console.log(`  [${index + 1}] ${point.timestampStr.substring(0, 19)} | Cycle ${currentCycle} | Elapsed: ${elapsedInCycle.toFixed(2)}s | Step: ${step} | Temp: ${temp}°C${isAnomaly ? ' ⚠️ ANOMALY' : ''}`)
        } else if (index === 5) {
          console.log(`  ... (${points.length - 10} more data points) ...`)
        }
      })

      if (issues.length > 0) {
        console.log(`\n  ❌ Issues found (${issues.length}):`)
        issues.forEach(issue => {
          console.log(`    - Index ${issue.index}: Step ${issue.calculatedStep} exceeds max ${issue.maxExpectedStep} at elapsed ${issue.elapsed}s (Cycle ${issue.cycle})`)
        })
        totalIssues += issues.length
      }

      if (anomalyCount > 0) {
        console.log(`\n  ⚠️  Anomalies detected: ${anomalyCount} data points with missing step intervals`)
        totalAnomalies += anomalyCount
      }

      // Count verification
      const uniqueTimestamps = new Set(points.map(p => p.timestampStr)).size
      const uniqueSteps = new Set(points.map((p, idx) => {
        const elapsed = (p.timestamp - cycleStart) / 1000
        const cyclePos = elapsed % profile.totalDuration
        const { normalizedMap } = normalizeStepMapping(profile.timeStepMap)
        let selected = normalizedMap[0]
        for (let i = normalizedMap.length - 1; i >= 0; i--) {
          if (normalizedMap[i].time <= cyclePos) {
            selected = normalizedMap[i]
            break
          }
        }
        return selected.step
      })).size

      console.log(`\n  Summary:`)
      console.log(`    - Timestamps: ${uniqueTimestamps} unique`)
      console.log(`    - Calculated Steps: ${uniqueSteps} unique (expected: ${profile.timeStepMap.length})`)
      console.log(`    - Step count matches: ${uniqueSteps === profile.timeStepMap.length ? '✅' : '❌'}`)
    })

    console.log(`\n\n=== Overall Summary ===`)
    console.log(`Total data points verified: ${allDataPoints.length}`)
    console.log(`Total issues: ${totalIssues}`)
    console.log(`Total anomalies: ${totalAnomalies}`)
    console.log(`Verification: ${totalIssues === 0 ? '✅ PASSED' : '❌ FAILED'}`)

  } catch (error) {
    console.error('Error:', error)
  }
}

// Run verification
verifyStepsAndTimestamps('Device_4')
  .then(() => {
    console.log('\nVerification completed.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Failed:', error)
    process.exit(1)
  })

