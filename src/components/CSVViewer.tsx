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

// Step-to-Temperature Mapping (for step-based temperature calculation)
interface StepTemperatureMapping {
  stepRange: [number, number] // [startStep, endStep] inclusive
  temperature: number // °C
}

// Time-Step Mapping (for time-based step calculation)
interface TimeStepMapping {
  time: number // seconds from cycle start
  step: number // step number at this time
  temp: number // temperature at this step
}

// Heater Profile Configuration
interface HeaterProfile {
  id: string
  totalDuration: number // seconds (cycle duration)
  steps: HeaterProfileStep[]
  stepTemperatureMap?: StepTemperatureMapping[] // Optional step-based temperature mapping
  timeStepMap?: TimeStepMapping[] // Optional time-based step mapping
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
    totalDuration: 18, // Cycle duration in seconds
    steps: [
      { startTime: 0, endTime: 6, temperature: 100 },
      { startTime: 6, endTime: 12, temperature: 200 },
      { startTime: 12, endTime: 18.34, temperature: 325 },
    ],
    // Time-based step mapping for HP-301
    // Maps elapsed time within cycle to step number and temperature
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
    id: '321',
    totalDuration: 18, // Cycle duration in seconds
    steps: [
      { startTime: 0, endTime: 6, temperature: 100 },
      { startTime: 6, endTime: 6, temperature: 325 }, // spike
      { startTime: 6, endTime: 12, temperature: 200 },
      { startTime: 12, endTime: 18.9, temperature: 325 },
    ],
    // Time-based step mapping for HP-321
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
    id: '322',
    totalDuration: 26, // Cycle duration in seconds
    steps: [
      { startTime: 0, endTime: 9, temperature: 100 },
      { startTime: 9, endTime: 9, temperature: 325 }, // spike
      { startTime: 9, endTime: 18, temperature: 200 },
      { startTime: 18, endTime: 27.44, temperature: 325 },
    ],
    // Time-based step mapping for HP-322
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
    id: '323',
    totalDuration: 18, // Cycle duration in seconds
    steps: [
      { startTime: 0, endTime: 6, temperature: 75 },
      { startTime: 6, endTime: 6, temperature: 350 }, // spike
      { startTime: 6, endTime: 12, temperature: 200 },
      { startTime: 12, endTime: 18.9, temperature: 325 },
    ],
    // Time-based step mapping for HP-323
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
    id: '324',
    totalDuration: 26, // Cycle duration in seconds
    steps: [
      { startTime: 0, endTime: 9, temperature: 75 },
      { startTime: 9, endTime: 9, temperature: 350 }, // spike
      { startTime: 9, endTime: 18, temperature: 200 },
      { startTime: 18, endTime: 27.44, temperature: 325 },
    ],
    // Time-based step mapping for HP-324
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
    id: '331',
    totalDuration: 75, // Cycle duration in seconds
    steps: [
      { startTime: 0, endTime: 20, temperature: 50 },
      { startTime: 20, endTime: 40, temperature: 350 },
      { startTime: 40, endTime: 60, temperature: 125 },
      { startTime: 60, endTime: 78.4, temperature: 350 },
    ],
    // Time-based step mapping for HP-331
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
    id: '332',
    totalDuration: 110, // Cycle duration in seconds
    steps: [
      { startTime: 0, endTime: 20, temperature: 50 },
      { startTime: 20, endTime: 60, temperature: 350 },
      { startTime: 60, endTime: 80, temperature: 125 },
      { startTime: 80, endTime: 112, temperature: 350 },
    ],
    // Time-based step mapping for HP-332
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
    id: '354',
    totalDuration: 10, // Cycle duration in seconds
    steps: [
      { startTime: 0, endTime: 2, temperature: 325 },
      { startTime: 2, endTime: 6, temperature: 100 },
      { startTime: 6, endTime: 8, temperature: 200 },
      { startTime: 8, endTime: 10.78, temperature: 325 },
    ],
    // Time-based step mapping for HP-354
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
    id: '411',
    totalDuration: 23, // Cycle duration in seconds
    steps: [
      { startTime: 0, endTime: 5, temperature: 100 },
      { startTime: 5, endTime: 8, temperature: 325 },
      { startTime: 8, endTime: 12, temperature: 150 },
      { startTime: 12, endTime: 15, temperature: 325 },
      { startTime: 15, endTime: 20, temperature: 200 },
      { startTime: 20, endTime: 24.64, temperature: 325 },
    ],
    // Time-based step mapping for HP-411
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
    id: '412',
    totalDuration: 36, // Cycle duration in seconds
    steps: [
      { startTime: 0, endTime: 8, temperature: 100 },
      { startTime: 8, endTime: 12, temperature: 325 },
      { startTime: 12, endTime: 20, temperature: 150 },
      { startTime: 20, endTime: 24, temperature: 325 },
      { startTime: 24, endTime: 30, temperature: 200 },
      { startTime: 30, endTime: 36.68, temperature: 325 },
    ],
    // Time-based step mapping for HP-412
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
    id: '413',
    totalDuration: 23, // Cycle duration in seconds
    steps: [
      { startTime: 0, endTime: 5, temperature: 75 },
      { startTime: 5, endTime: 8, temperature: 350 },
      { startTime: 8, endTime: 12, temperature: 150 },
      { startTime: 12, endTime: 16, temperature: 325 },
      { startTime: 16, endTime: 20, temperature: 200 },
      { startTime: 20, endTime: 24.64, temperature: 325 },
    ],
    // Time-based step mapping for HP-413
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
    id: '414',
    totalDuration: 36, // Cycle duration in seconds
    steps: [
      { startTime: 0, endTime: 8, temperature: 75 },
      { startTime: 8, endTime: 12, temperature: 350 },
      { startTime: 12, endTime: 20, temperature: 150 },
      { startTime: 20, endTime: 24, temperature: 325 },
      { startTime: 24, endTime: 30, temperature: 200 },
      { startTime: 30, endTime: 36.68, temperature: 325 },
    ],
    // Time-based step mapping for HP-414
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
    id: '501',
    totalDuration: 26, // Cycle duration in seconds
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
    // Time-based step mapping for HP-501
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
    id: '502',
    totalDuration: 35, // Cycle duration in seconds
    steps: [
      { startTime: 0, endTime: 5, temperature: 200 },
      { startTime: 5, endTime: 10, temperature: 260 },
      { startTime: 10, endTime: 15, temperature: 320 },
      { startTime: 15, endTime: 20, temperature: 260 },
      { startTime: 20, endTime: 25, temperature: 200 },
      { startTime: 25, endTime: 30, temperature: 150 },
      { startTime: 30, endTime: 35.84, temperature: 125 }, // 100-150°C average
    ],
    // Time-based step mapping for HP-502
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
    id: '503',
    totalDuration: 26, // Cycle duration in seconds
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
    // Time-based step mapping for HP-503
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
    id: '504',
    totalDuration: 35, // Cycle duration in seconds
    steps: [
      { startTime: 0, endTime: 5, temperature: 200 },
      { startTime: 5, endTime: 10, temperature: 275 },
      { startTime: 10, endTime: 15, temperature: 350 },
      { startTime: 15, endTime: 20, temperature: 275 },
      { startTime: 20, endTime: 25, temperature: 200 },
      { startTime: 25, endTime: 30, temperature: 150 },
      { startTime: 30, endTime: 35.84, temperature: 125 }, // 100-150°C average
    ],
    // Time-based step mapping for HP-504
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

/**
 * Extract heater profile ID from HP string (e.g., "Hp_301" -> "301", "HP_001" -> "001")
 */
const extractProfileId = (hpString: string): string => {
  const normalized = hpString.replace(/^[Hh][Pp]_?/, '').trim()
  return normalized
}


/**
 * Normalize step numbers in timeStepMap to fill gaps and detect anomalies
 * Returns normalized mapping and list of missing steps (anomalies)
 */
const normalizeStepMapping = (timeStepMap: TimeStepMapping[]): {
  normalizedMap: Array<{ time: number; step: number; temp: number; originalStep: number; isAnomaly: boolean }>
  anomalies: number[] // List of missing step numbers
} => {
  if (!timeStepMap || timeStepMap.length === 0) {
    return { normalizedMap: [], anomalies: [] }
  }

  // Sort by step number
  const sortedMap = [...timeStepMap].sort((a, b) => a.step - b.step)
  
  // Find expected step numbers and detect gaps
  const anomalies: number[] = []
  const stepSet = new Set(sortedMap.map(m => m.step))
  
  if (sortedMap.length > 0) {
    const minStep = sortedMap[0].step
    const maxStep = sortedMap[sortedMap.length - 1].step
    
    // Check for gaps in step sequence
    for (let stepNum = minStep; stepNum <= maxStep; stepNum++) {
      if (!stepSet.has(stepNum)) {
        anomalies.push(stepNum)
      }
    }
  }

  // Create normalized mapping with sequential step numbers (1, 2, 3, ...)
  const normalizedMap = sortedMap.map((mapping, index) => ({
    time: mapping.time,
    step: index + 1, // Sequential step number (1, 2, 3, ...)
    temp: mapping.temp,
    originalStep: mapping.step, // Keep original step number for reference
    isAnomaly: anomalies.includes(mapping.step), // Mark if this step follows a gap
  }))

  return { normalizedMap, anomalies }
}

// Cache for normalized mappings per HP profile
const normalizedMappingCache: Record<string, {
  normalizedMap: Array<{ time: number; step: number; temp: number; originalStep: number; isAnomaly: boolean }>
  anomalies: number[]
}> = {}

/**
 * Calculate step number and temperature based on elapsed time within cycle
 * Uses timeStepMap if available, otherwise falls back to time-based calculation
 * Handles missing step intervals by normalizing step numbers sequentially
 */
const calculateStepAndTempFromTime = (hpId: string, elapsedSeconds: number): { step: number; temp: number; isAnomaly?: boolean; missedStep?: number } => {
  const profileId = extractProfileId(hpId)
  const profile = HEATER_PROFILES[profileId]

  if (!profile) {
    console.warn(`Unknown heater profile: ${hpId} (extracted ID: ${profileId})`)
    return { step: 1, temp: 0, isAnomaly: false }
  }

  // Handle cycles that repeat - use modulo to get position within current cycle
  // Ensure elapsedSeconds is non-negative
  const safeElapsedSeconds = Math.max(0, elapsedSeconds)
  const cyclePosition = safeElapsedSeconds % profile.totalDuration

  // If time-based step mapping exists, use it
  if (profile.timeStepMap && profile.timeStepMap.length > 0) {
    // Get or create normalized mapping (with anomaly detection)
    if (!normalizedMappingCache[profileId]) {
      normalizedMappingCache[profileId] = normalizeStepMapping(profile.timeStepMap)
      
      // Log anomalies if detected
      if (normalizedMappingCache[profileId].anomalies.length > 0) {
        console.warn(`[HP-${profileId}] Anomaly detected: Missing step numbers: ${normalizedMappingCache[profileId].anomalies.join(', ')}`)
      }
    }

    const { normalizedMap, anomalies } = normalizedMappingCache[profileId]
    
    // Find the appropriate step based on elapsed time
    // Find the last time point that is <= cyclePosition
    let selectedMapping = normalizedMap[0] // Default to first
    let selectedIndex = 0
    
    // Search backwards to find the most recent time point <= cyclePosition
    for (let i = normalizedMap.length - 1; i >= 0; i--) {
      if (normalizedMap[i].time <= cyclePosition) {
        selectedMapping = normalizedMap[i]
        selectedIndex = i
        break
      }
    }
    
    // Check if the previous step was missed
    // The isAnomaly flag indicates that a step before this one was missed
    let missedStep: number | undefined = undefined
    if (selectedMapping.isAnomaly && anomalies.length > 0) {
      const currentOriginalStep = selectedMapping.originalStep
      
      // Find the most recent missed step before the current step
      // Get all anomalies that are less than the current original step
      const relevantAnomalies = anomalies.filter(a => a < currentOriginalStep)
      
      if (relevantAnomalies.length > 0) {
        // Get the most recent missed step (highest value that's still less than current)
        missedStep = Math.max(...relevantAnomalies)
      } else if (selectedIndex > 0) {
        // Fallback: check gap between current and previous step
        const previousMapping = normalizedMap[selectedIndex - 1]
        const previousOriginalStep = previousMapping.originalStep
        
        // If there's a gap, the missed step is right before current
        if (currentOriginalStep - previousOriginalStep > 1) {
          missedStep = currentOriginalStep - 1
        }
      }
    }
    
    // Debug logging (can be removed in production)
    if (cyclePosition > 0 && selectedMapping.step === 1 && normalizedMap.length > 1) {
      console.debug(`[HP-${profileId}] elapsedSeconds: ${elapsedSeconds}, cyclePosition: ${cyclePosition}, selectedStep: ${selectedMapping.step}, time: ${selectedMapping.time}`)
    }
    
    return { 
      step: selectedMapping.step, // Use normalized sequential step number
      temp: selectedMapping.temp,
      isAnomaly: selectedMapping.isAnomaly,
      missedStep: missedStep
    }
  }

  // Fallback: calculate step based on time ranges in steps array
  let stepNumber = 1
  for (let i = 0; i < profile.steps.length; i++) {
    const step = profile.steps[i]
    if (cyclePosition >= step.startTime && cyclePosition < step.endTime) {
      stepNumber = i + 1
      return { step: stepNumber, temp: step.temperature, isAnomaly: false }
    }
  }

  // If at or beyond cycle end, use last step
  const lastStep = profile.steps[profile.steps.length - 1]
  return { step: profile.steps.length, temp: lastStep.temperature, isAnomaly: false }
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
  Anomaly?: boolean // Flag indicating if this step has an anomaly (missing step interval)
  MissedStep?: number // The step number that was missed before this step
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
  const [anomalyFilter, setAnomalyFilter] = useState<string>('all') // 'all', 'yes', 'no'
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: keyof CSVDataRow | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' })
  
  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    Device_ID: true,
    Sensor_ID: true,
    HP: true,
    TimeStamp: true,
    Temp: true,
    Hu: true,
    Vol: true,
    ADC: true,
    SeqNO: true,
    TotalTime: true,
    Heater_Temp: true,
    Step: true,
    Anomaly: true,
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

        // Track cycle information for each HP profile
        // Key: `${sensorId}_${hpId}`, Value: { cycleStartTime, lastTimestamp, profileDuration }
        const hpCycleInfo: Record<string, { cycleStartTime: number; lastTimestamp: number; profileDuration: number }> = {}

        // Track step count per sensor
        // Key: sensorId, Value: { stepCount, lastHeaterTemp, lastHpId }
        const sensorStepInfo: Record<string, { stepCount: number; lastHeaterTemp: number; lastHpId: string }> = {}
        
        // Track last HP per sensor to detect HP changes
        // Key: sensorId, Value: lastHpId
        const sensorLastHp: Record<string, string> = {}
        
        // Track last step per sensor+HP combination to detect step skips
        // Key: `${sensorId}_${hpId}`, Value: { lastStep: number, cycleNumber: number }
        const sensorHpStepTracker: Record<string, { lastStep: number; cycleNumber: number }> = {}

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
          // 1. First time seeing this sensor+HP combination
          // 2. HP changed for this sensor (check last HP for this sensor)
          // 3. Enough time has passed since last timestamp (gap > profile duration)
          const lastHpForSensor = sensorLastHp[point.sensorId]
          const hpChanged = lastHpForSensor !== undefined && lastHpForSensor !== point.hpId
          const gapTooLarge = cycleInfo && profileDuration > 0 && 
            (point.timestampTime - cycleInfo.lastTimestamp) / 1000 > profileDuration * 1.5
          
          const isNewCycle = !cycleInfo || hpChanged || gapTooLarge

          if (isNewCycle) {
            // Start a new cycle
            hpCycleInfo[hpKey] = {
              cycleStartTime: point.timestampTime,
              lastTimestamp: point.timestampTime,
              profileDuration,
            }
            // Reset step tracker for new cycle
            const trackerKey = `${point.sensorId}_${point.hpId}`
            if (sensorHpStepTracker[trackerKey]) {
              sensorHpStepTracker[trackerKey].cycleNumber++
              sensorHpStepTracker[trackerKey].lastStep = 0 // Reset to allow step 1
            }
          } else if (cycleInfo) {
            // Update last timestamp for existing cycle
            cycleInfo.lastTimestamp = point.timestampTime
          }

          // Calculate elapsed time within current HP cycle
          const cycleStartTime = hpCycleInfo[hpKey]?.cycleStartTime || point.timestampTime
          let elapsedInCycleSeconds = (point.timestampTime - cycleStartTime) / 1000

          // Ensure elapsed time is non-negative
          if (elapsedInCycleSeconds < 0) {
            elapsedInCycleSeconds = 0
          }

          // Check if we need to reset cycle (when elapsed time >= cycle duration)
          // Reset cycle and recalculate elapsed time
          if (elapsedInCycleSeconds >= profileDuration && profileDuration > 0) {
            // Reset cycle - start a new cycle
            const cyclesCompleted = Math.floor(elapsedInCycleSeconds / profileDuration)
            elapsedInCycleSeconds = elapsedInCycleSeconds % profileDuration
            
            // Update cycle start time to reflect the new cycle
            hpCycleInfo[hpKey] = {
              cycleStartTime: cycleStartTime + (cyclesCompleted * profileDuration * 1000),
              lastTimestamp: point.timestampTime,
              profileDuration,
            }
          }

          // Calculate step number and temperature based on elapsed time within cycle
          // This uses timeStepMap if available, which maps time → step → temperature
          // Handles missing step intervals by normalizing step numbers sequentially
          const { step: stepCount, temp: heaterTemp } = calculateStepAndTempFromTime(point.hpId, elapsedInCycleSeconds)
          
          // Detect step anomalies by tracking step sequence within each cycle
          // Check if steps are being skipped in the actual data sequence
          let hasAnomaly = false
          let missedStep: number | undefined = undefined
          
          const trackerKey = `${point.sensorId}_${point.hpId}`
          let tracker = sensorHpStepTracker[trackerKey]
          
          // Initialize tracker if it doesn't exist
          if (!tracker) {
            tracker = {
              lastStep: 0, // Start at 0 so step 1 is valid
              cycleNumber: 1
            }
            sensorHpStepTracker[trackerKey] = tracker
          }
          
          // Reset tracker if this is a new cycle (detected earlier)
          if (isNewCycle) {
            tracker.lastStep = 0
            tracker.cycleNumber++
          }
          
          // Check for step skips within the current cycle
          if (tracker.lastStep > 0) {
            const expectedNextStep = tracker.lastStep + 1
            
            // If current step is greater than expected next step, steps were skipped
            if (stepCount > expectedNextStep) {
              hasAnomaly = true
              // The first missed step is the one right after the last step
              missedStep = expectedNextStep
            } else if (stepCount < tracker.lastStep && stepCount !== 1) {
              // Step went backwards unexpectedly (not a cycle reset)
              // This shouldn't happen in normal operation, mark as anomaly
              hasAnomaly = true
              missedStep = tracker.lastStep
            }
          }
          
          // Update tracker with current step
          tracker.lastStep = stepCount

          // Debug logging for step calculation issues
          if (stepCount === 1 && elapsedInCycleSeconds > 1 && csvData.length < 10) {
            console.log(`[DEBUG] HP: ${point.hpId}, elapsedInCycleSeconds: ${elapsedInCycleSeconds.toFixed(2)}, step: ${stepCount}, profileDuration: ${profileDuration}`)
          }

          // Update step tracking info
          sensorStepInfo[point.sensorId] = {
            stepCount,
            lastHeaterTemp: heaterTemp,
            lastHpId: point.hpId,
          }
          
          // Update last HP for this sensor
          sensorLastHp[point.sensorId] = point.hpId

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
            Anomaly: hasAnomaly,
            MissedStep: missedStep,
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

    // Anomaly filter
    if (anomalyFilter === 'yes') {
      filtered = filtered.filter(row => row.Anomaly === true)
    } else if (anomalyFilter === 'no') {
      filtered = filtered.filter(row => row.Anomaly === false)
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
  }, [selectedDate, allData, selectedSensor, selectedHP, selectedStep, anomalyFilter, searchQuery, sortConfig])

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
        if (typeof value === 'number') {
          if (header === 'Temp' || header === 'Hu' || header === 'Vol' || header === 'ADC') {
            csvRow.push(value.toFixed(3))
          } else if (header === 'Heater_Temp') {
            csvRow.push(value.toFixed(1))
          } else {
            csvRow.push(value.toString())
          }
        } else if (header === 'Anomaly') {
          if (value && row.MissedStep) {
            csvRow.push(`Previous step ${row.MissedStep} missed`)
          } else {
            csvRow.push(value ? 'Yes' : 'No')
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
            <div className="filter-group">
              <label>Anomaly:</label>
              <select
                className="filter-select"
                value={anomalyFilter}
                onChange={(e) => setAnomalyFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="yes">Yes Only</option>
                <option value="no">No Only</option>
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
                setAnomalyFilter('all')
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
                    {visibleColumns.Temp && (
                      <th onClick={() => handleSort('Temp')} className="sortable">
                        Temp {sortConfig.key === 'Temp' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {visibleColumns.Hu && (
                      <th onClick={() => handleSort('Hu')} className="sortable">
                        Hu {sortConfig.key === 'Hu' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {visibleColumns.Vol && (
                      <th onClick={() => handleSort('Vol')} className="sortable">
                        Vol {sortConfig.key === 'Vol' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {visibleColumns.ADC && (
                      <th onClick={() => handleSort('ADC')} className="sortable">
                        ADC {sortConfig.key === 'ADC' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
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
                    {visibleColumns.Heater_Temp && (
                      <th onClick={() => handleSort('Heater_Temp')} className="sortable">
                        Heater_Temp {sortConfig.key === 'Heater_Temp' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {visibleColumns.Step && (
                      <th onClick={() => handleSort('Step')} className="sortable">
                        Step {sortConfig.key === 'Step' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {visibleColumns.Anomaly && (
                      <th onClick={() => handleSort('Anomaly')} className="sortable">
                        Anomaly {sortConfig.key === 'Anomaly' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
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
                      <tr key={index} className={row.Anomaly ? 'anomaly-row' : ''}>
                        {visibleColumns.Device_ID && <td>{row.Device_ID}</td>}
                        {visibleColumns.Sensor_ID && <td>{row.Sensor_ID}</td>}
                        {visibleColumns.HP && <td>{row.HP}</td>}
                        {visibleColumns.TimeStamp && <td>{row.TimeStamp}</td>}
                        {visibleColumns.Temp && <td>{row.Temp.toFixed(3)}</td>}
                        {visibleColumns.Hu && <td>{row.Hu.toFixed(3)}</td>}
                        {visibleColumns.Vol && <td>{row.Vol.toFixed(3)}</td>}
                        {visibleColumns.ADC && <td>{row.ADC.toFixed(3)}</td>}
                        {visibleColumns.SeqNO && <td>{row.SeqNO}</td>}
                        {visibleColumns.TotalTime && <td>{row.TotalTime}</td>}
                        {visibleColumns.Heater_Temp && <td>{row.Heater_Temp.toFixed(1)}</td>}
                        {visibleColumns.Step && <td>{row.Step}</td>}
                        {visibleColumns.Anomaly && (
                          <td className={row.Anomaly ? 'anomaly-cell' : ''}>
                            {row.Anomaly && row.MissedStep 
                              ? `⚠️ Previous step ${row.MissedStep} missed` 
                              : row.Anomaly 
                                ? '⚠️ Yes' 
                                : 'No'}
                          </td>
                        )}
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

