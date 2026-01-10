// Detailed verification script for timestamps, step counts, and heater profile mappings
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, get } from 'firebase/database'

const firebaseConfig = {
  databaseURL: 'https://knose-e1959-default-rtdb.firebaseio.com/'
}

const app = initializeApp(firebaseConfig)
const database = getDatabase(app)

// Import all heater profiles (same as CSVViewer.tsx)
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

async function detailedVerification(deviceId = 'Device_4') {
  try {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`DETAILED VERIFICATION REPORT: ${deviceId}`)
    console.log(`${'='.repeat(80)}\n`)
    
    const deviceRef = ref(database, deviceId)
    const snapshot = await get(deviceRef)

    if (!snapshot.exists()) {
      console.log(`❌ Device ${deviceId} not found`)
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

    allDataPoints.sort((a, b) => a.timestamp - b.timestamp)

    if (allDataPoints.length === 0) {
      console.log('❌ No data points found')
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

    console.log(`📊 OVERALL STATISTICS`)
    console.log(`   Total Data Points: ${allDataPoints.length}`)
    console.log(`   Unique Sensor+HP Combinations: ${Object.keys(groupedData).length}`)
    console.log(`   Time Range: ${new Date(allDataPoints[0].timestamp).toISOString()} to ${new Date(allDataPoints[allDataPoints.length - 1].timestamp).toISOString()}\n`)

    // Detailed analysis for each sensor+HP combination
    const report = {
      totalCombinations: Object.keys(groupedData).length,
      combinations: [],
      overallIssues: [],
      overallAnomalies: 0,
    }

    Object.keys(groupedData).forEach(key => {
      const parts = key.split('_')
      const sensorId = parts[0] + '_' + parts[1]
      const hpId = parts.slice(2).join('_')
      const points = groupedData[key]
      const profileId = extractProfileId(hpId)
      const profile = HEATER_PROFILES[profileId]

      if (!profile) {
        report.overallIssues.push({
          combination: key,
          issue: `Profile ${profileId} not configured`,
          severity: 'warning'
        })
        return
      }

      const { normalizedMap, anomalies } = normalizeStepMapping(profile.timeStepMap)
      const combinationReport = {
        key,
        sensorId,
        hpId,
        profileId,
        totalDataPoints: points.length,
        expectedSteps: profile.timeStepMap.length,
        anomalies: anomalies,
        normalizedMap: normalizedMap, // Store for later use
        cycles: [],
        stepDistribution: {},
        missingSteps: [],
        issues: [],
      }

      // Track cycles (matching CSVViewer logic)
      let cycleStartTime = points[0].timestamp
      let lastTimestamp = points[0].timestamp
      let currentCycle = 1
      const cycleData = []
      const stepCounts = new Set()
      const stepTimeRanges = {} // Track time ranges for each step

      points.forEach((point, index) => {
        // Check if this is a new cycle (gap > profile duration * 1.5)
        const timeSinceLastTimestamp = (point.timestamp - lastTimestamp) / 1000
        const isNewCycle = index === 0 || 
          (timeSinceLastTimestamp > profile.totalDuration * 1.5 && profile.totalDuration > 0)
        
        if (isNewCycle && index > 0) {
          cycleStartTime = point.timestamp
          currentCycle++
        }
        
        lastTimestamp = point.timestamp
        
        // Calculate elapsed time within current cycle
        let elapsedInCycleSeconds = (point.timestamp - cycleStartTime) / 1000
        
        // Reset cycle if elapsed time >= cycle duration (matching CSVViewer logic)
        if (elapsedInCycleSeconds >= profile.totalDuration && profile.totalDuration > 0) {
          const cyclesCompleted = Math.floor(elapsedInCycleSeconds / profile.totalDuration)
          elapsedInCycleSeconds = elapsedInCycleSeconds % profile.totalDuration
          cycleStartTime = cycleStartTime + (cyclesCompleted * profile.totalDuration * 1000)
          currentCycle += cyclesCompleted
        }

        const { step, temp, isAnomaly } = calculateStepAndTempFromTime(hpId, elapsedInCycleSeconds, profile)
        stepCounts.add(step)

        // Track step time ranges (within cycle, so should be 0 to profile.totalDuration)
        if (!stepTimeRanges[step]) {
          stepTimeRanges[step] = { min: elapsedInCycleSeconds, max: elapsedInCycleSeconds, count: 0 }
        }
        stepTimeRanges[step].min = Math.min(stepTimeRanges[step].min, elapsedInCycleSeconds)
        stepTimeRanges[step].max = Math.max(stepTimeRanges[step].max, elapsedInCycleSeconds)
        stepTimeRanges[step].count++

        cycleData.push({
          index: index + 1,
          timestamp: point.timestampStr,
          cycle: currentCycle,
          elapsed: elapsedInCycleSeconds,
          step,
          temp,
          isAnomaly,
        })
      })

      combinationReport.stepDistribution = stepTimeRanges
      combinationReport.actualSteps = stepCounts.size
      combinationReport.cyclesDetected = Math.max(...cycleData.map(d => d.cycle))

      // Find missing steps
      const expectedStepNumbers = new Set(combinationReport.normalizedMap.map(m => m.step))
      const actualStepNumbers = stepCounts
      expectedStepNumbers.forEach(stepNum => {
        if (!actualStepNumbers.has(stepNum)) {
          combinationReport.missingSteps.push(stepNum)
        }
      })

      // Count anomalies in data
      const anomalyCount = cycleData.filter(d => d.isAnomaly).length
      combinationReport.anomalyCount = anomalyCount
      report.overallAnomalies += anomalyCount

      // Check for issues
      if (combinationReport.missingSteps.length > 0) {
        combinationReport.issues.push({
          type: 'missing_steps',
          message: `Missing steps: ${combinationReport.missingSteps.join(', ')}`,
          severity: 'info'
        })
      }

      if (combinationReport.actualSteps !== combinationReport.expectedSteps) {
        combinationReport.issues.push({
          type: 'step_count_mismatch',
          message: `Expected ${combinationReport.expectedSteps} steps, found ${combinationReport.actualSteps}`,
          severity: 'warning'
        })
      }

      report.combinations.push(combinationReport)
    })

    // Print detailed report
    report.combinations.forEach(combo => {
      console.log(`${'─'.repeat(80)}`)
      console.log(`\n📋 ${combo.key}`)
      console.log(`   Profile: HP-${combo.profileId} | Duration: ${HEATER_PROFILES[combo.profileId].totalDuration}s`)
      console.log(`   Data Points: ${combo.totalDataPoints} | Cycles Detected: ${combo.cyclesDetected}`)
      
      // Step analysis
      console.log(`\n   📈 STEP ANALYSIS:`)
      console.log(`      Expected Steps: ${combo.expectedSteps}`)
      console.log(`      Actual Steps Found: ${combo.actualSteps}`)
      console.log(`      Missing Steps: ${combo.missingSteps.length > 0 ? combo.missingSteps.join(', ') : 'None ✅'}`)
      console.log(`      Anomalies Detected: ${combo.anomalyCount} (missing step intervals in mapping)`)
      
      if (combo.anomalies.length > 0) {
        console.log(`      ⚠️  Mapping Anomalies: Steps ${combo.anomalies.join(', ')} are missing in the timeStepMap`)
      }

      // Step distribution
      console.log(`\n   📊 STEP DISTRIBUTION:`)
      const sortedSteps = Object.keys(combo.stepDistribution).map(Number).sort((a, b) => a - b)
      sortedSteps.forEach(step => {
        const dist = combo.stepDistribution[step]
        const expectedTime = combo.normalizedMap.find(m => m.step === step)?.time
        console.log(`      Step ${String(step).padStart(2)}: ${dist.count.toString().padStart(4)} occurrences | Time range: ${dist.min.toFixed(2)}s - ${dist.max.toFixed(2)}s | Expected: ${expectedTime !== undefined ? expectedTime + 's' : 'N/A'}`)
      })

      // Missing steps details
      if (combo.missingSteps.length > 0) {
        console.log(`\n   ⚠️  MISSING STEPS DETAILS:`)
        combo.missingSteps.forEach(step => {
          const expectedMapping = combo.normalizedMap.find(m => m.step === step)
          if (expectedMapping) {
            console.log(`      Step ${step}: Expected at time ${expectedMapping.time}s (${expectedMapping.temp}°C) - No data points found in this time range`)
          }
        })
      }

      // Issues summary
      if (combo.issues.length > 0) {
        console.log(`\n   ⚠️  ISSUES:`)
        combo.issues.forEach(issue => {
          console.log(`      [${issue.severity.toUpperCase()}] ${issue.message}`)
        })
      } else {
        console.log(`\n   ✅ No issues detected`)
      }
    })

    // Overall summary
    console.log(`\n${'='.repeat(80)}`)
    console.log(`📊 OVERALL SUMMARY`)
    console.log(`${'='.repeat(80)}`)
    console.log(`Total Combinations Analyzed: ${report.totalCombinations}`)
    console.log(`Total Anomalies (missing step intervals): ${report.overallAnomalies}`)
    console.log(`Combinations with Issues: ${report.combinations.filter(c => c.issues.length > 0).length}`)
    console.log(`Combinations without Issues: ${report.combinations.filter(c => c.issues.length === 0).length}`)
    
    if (report.overallIssues.length > 0) {
      console.log(`\n⚠️  Unconfigured Profiles:`)
      report.overallIssues.forEach(issue => {
        console.log(`   - ${issue.combination}: ${issue.issue}`)
      })
    }

    console.log(`\n${'='.repeat(80)}\n`)

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

// Run verification
detailedVerification('Device_4')
  .then(() => {
    console.log('✅ Detailed verification completed.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Failed:', error)
    process.exit(1)
  })

