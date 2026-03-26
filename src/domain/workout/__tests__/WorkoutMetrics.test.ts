import { describe, it, expect } from 'vitest'
import { computeAvgReps, computeVolume, computeE1RM } from '../WorkoutMetrics'
import type { ExerciseLog } from '../../shared/DB'

function makeLog(overrides: Partial<ExerciseLog> = {}): ExerciseLog {
  return {
    exercise_id: 'curl_biceps',
    name: 'Curl de bíceps',
    series: 3,
    reps: { expected: 10, actual: [] },
    weight: 60,
    ...overrides,
  }
}

describe('computeAvgReps', () => {
  it('usa reps.actual cuando están disponibles', () => {
    const log = makeLog({ reps: { expected: 10, actual: [8, 9, 10] } })
    expect(computeAvgReps(log)).toBeCloseTo(9)
  })

  it('usa reps.expected cuando actual está vacío', () => {
    const log = makeLog({ reps: { expected: 10, actual: [] } })
    expect(computeAvgReps(log)).toBe(10)
  })
})

describe('computeVolume', () => {
  it('peso × series × avgReps cuando weight > 0', () => {
    const log = makeLog({ series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 60 })
    expect(computeVolume(log)).toBe(1800)
  })

  it('series × avgReps cuando weight = 0 (ejercicio de peso corporal)', () => {
    const log = makeLog({ series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 0 })
    expect(computeVolume(log)).toBe(30)
  })
})

describe('computeE1RM', () => {
  it('peso × (1 + avgReps/30) cuando weight > 0', () => {
    const log = makeLog({ reps: { expected: 10, actual: [10, 10, 10] }, weight: 100 })
    expect(computeE1RM(log)).toBeCloseTo(133.33)
  })

  it('retorna 0 cuando weight = 0', () => {
    const log = makeLog({ reps: { expected: 10, actual: [10] }, weight: 0 })
    expect(computeE1RM(log)).toBe(0)
  })
})
