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
  const expectedSteps: number[] = []
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
const calculateStepAndTempFromTime = (hpId: string, elapsedSeconds: number): { step: number; temp: number; isAnomaly?: boolean } => {
  const profileId = extractProfileId(hpId)
  const profile = HEATER_PROFILES[profileId]

  if (!profile) {
    console.warn(`Unknown heater profile: ${hpId} (extracted ID: ${profileId})`)
    return { step: 1, temp: 0, isAnomaly: false }
  }

  // Handle cycles that repeat - use modulo to get position within current cycle
  const cyclePosition = elapsedSeconds % profile.totalDuration

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

    const { normalizedMap } = normalizedMappingCache[profileId]
    
    // Find the appropriate step based on elapsed time
    // Find the last time point that is <= cyclePosition
    let selectedMapping = normalizedMap[0] // Default to first
    
    for (let i = normalizedMap.length - 1; i >= 0; i--) {
      if (normalizedMap[i].time <= cyclePosition) {
        selectedMapping = normalizedMap[i]
        break
      }
    }
    
    return { 
      step: selectedMapping.step, // Use normalized sequential step number
      temp: selectedMapping.temp,
      isAnomaly: selectedMapping.isAnomaly
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

/**
 * Calculate heater temperature based on step count (if step mapping exists) or elapsed time
 * This function is kept for backward compatibility but prefers time-based calculation
 */
const calculateHeaterTemp = (hpId: string, stepCount: number, elapsedSeconds: number): number => {
  const profileId = extractProfileId(hpId)
  const profile = HEATER_PROFILES[profileId]

  if (!profile) {
    console.warn(`Unknown heater profile: ${hpId} (extracted ID: ${profileId})`)
    return 0
  }

  // If time-based step mapping exists, use it (preferred method)
  if (profile.timeStepMap && profile.timeStepMap.length > 0) {
    const { temp } = calculateStepAndTempFromTime(hpId, elapsedSeconds)
    return temp
  }

  // If step-based temperature mapping exists, use it
  if (profile.stepTemperatureMap && profile.stepTemperatureMap.length > 0) {
    for (const mapping of profile.stepTemperatureMap) {
      const [startStep, endStep] = mapping.stepRange
      if (stepCount >= startStep && stepCount <= endStep) {
        return mapping.temperature
      }
    }
    // If step count exceeds the mapping, use the last mapping's temperature
    const lastMapping = profile.stepTemperatureMap[profile.stepTemperatureMap.length - 1]
    return lastMapping.temperature
  }

  // Fallback to time-based calculation if no step mapping exists
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
  Anomaly?: boolean // Flag indicating if this step has an anomaly (missing step interval)
}

const CSVViewer = ({ deviceId, deviceName, onClose }: CSVViewerProps) => {
  const [allData, setAllData] = useState<CSVDataRow[]>([]) // Store all data
  const [filteredData, setFilteredData] = useState<CSVDataRow[]>([]) // Filtered data for display
  const [availableDates, setAvailableDates] = useState<string[]>([]) // Available dates from Firebase
  const [selectedDate, setSelectedDate] = useState<string>('') // Selected date filter
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
          let elapsedInCycleSeconds = (point.timestampTime - cycleStartTime) / 1000

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
          const { step: stepCount, temp: heaterTemp, isAnomaly } = calculateStepAndTempFromTime(point.hpId, elapsedInCycleSeconds)

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
            Anomaly: isAnomaly || false, // Mark if this step has an anomaly (missing step interval)
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

  // Filter data based on selected date
  useEffect(() => {
    if (selectedDate && allData.length > 0) {
      const filtered = allData.filter((row) => {
        // Extract date from timestamp (format: MM-DD-YYYY-HH:MM:SS:NS)
        // Convert to YYYY-MM-DD for comparison with selectedDate
        const timestampStr = row.TimeStamp // Format: "MM-DD-YYYY-HH:MM:SS:NS"
        // Split by '-' and take first 3 parts: MM, DD, YYYY
        const parts = timestampStr.split('-')
        if (parts.length >= 3) {
          const month = parts[0]?.padStart(2, '0') || ''
          const day = parts[1]?.padStart(2, '0') || ''
          const year = parts[2] || ''
          // Reconstruct as YYYY-MM-DD for comparison
          const formattedDate = `${year}-${month}-${day}`
          return formattedDate === selectedDate
        }
        return false
      })
      setFilteredData(filtered)
    } else if (allData.length > 0) {
      // If no date selected, show all data
      setFilteredData(allData)
    } else {
      setFilteredData([])
    }
  }, [selectedDate, allData])

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
    if (allData.length === 0) return

    const headers = ['Device_ID', 'Sensor_ID', 'HP', 'TimeStamp', 'Temp', 'Hu', 'Vol', 'ADC', 'SeqNO', 'TotalTime', 'Heater_Temp', 'Step', 'Anomaly']
    const csvRows: string[] = [headers.join(',')]

    // Export ALL data: all sensors (BME_01 to BME_16), all heater profiles, all timestamps, all dates
    // This exports everything for the selected device, regardless of date filter
    allData.forEach((row) => {
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
        row.Anomaly ? 'Yes' : 'No', // Anomaly flag: Yes if step interval is missing
      ]
      csvRows.push(csvRow.join(','))
    })

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', `${deviceName.replace(/\s+/g, '_')}_all_data_${new Date().toISOString().split('T')[0]}.csv`)
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
            <div className="csv-viewer-date-selector">
              <label htmlFor="date-select" className="date-select-label">Select Date:</label>
              <select
                id="date-select"
                className="date-select"
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
                      // Format date for display: YYYY-MM-DD -> MM/DD/YYYY
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
            <button 
              className="csv-viewer-button csv-viewer-export" 
              onClick={handleExport}
              disabled={filteredData.length === 0}
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
                    <th>Anomaly</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row, index) => (
                    <tr key={index} className={row.Anomaly ? 'anomaly-row' : ''}>
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
                      <td className={row.Anomaly ? 'anomaly-cell' : ''}>{row.Anomaly ? '⚠️ Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="csv-viewer-footer">
                <p>Total Records: {filteredData.length} {selectedDate && `(Filtered by ${selectedDate})`}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CSVViewer

