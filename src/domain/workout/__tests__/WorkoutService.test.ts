import { describe, it, expect } from 'vitest'
import { detectPR } from '../WorkoutService'
import type { ExerciseLog, HistoryEntry } from '../../shared/DB'

function makeLog(overrides: Partial<ExerciseLog> = {}): ExerciseLog {
  return {
    exercise_id: 'curl_biceps',
    name: 'Curl de bíceps',
    series: 3,
    reps: { expected: 10, actual: [10, 10, 10] },
    weight: 60,
    ...overrides,
  }
}

function makeEntry(logs: ExerciseLog[]): HistoryEntry {
  return { date: '2026-01-01', type: 'LUNES', completed: true, logs }
}

describe('detectPR', () => {
  it('true cuando el volumen supera el máximo histórico (con reps reales)', () => {
    const current = makeLog({ weight: 60, series: 3, reps: { expected: 10, actual: [10, 10, 10] } })
    const history = [makeEntry([makeLog({ weight: 50, series: 3, reps: { expected: 10, actual: [10, 10, 10] } })])]
    expect(detectPR(current, history)).toBe(true)
  })

  it('true cuando el e1RM supera el máximo histórico (con reps reales)', () => {
    const current = makeLog({ weight: 80, series: 3, reps: { expected: 10, actual: [10, 10, 10] } })
    const history = [makeEntry([makeLog({ weight: 60, series: 3, reps: { expected: 10, actual: [10, 10, 10] } })])]
    expect(detectPR(current, history)).toBe(true)
  })

  it('false cuando no hay reps actuales registradas', () => {
    const current = makeLog({ weight: 100, series: 3, reps: { expected: 10, actual: [] } })
    const history = [makeEntry([makeLog({ weight: 60, series: 3, reps: { expected: 10, actual: [10, 10, 10] } })])]
    expect(detectPR(current, history)).toBe(false)
  })

  it('false cuando ni volumen ni e1RM mejoran', () => {
    const current = makeLog({ weight: 40, series: 3, reps: { expected: 10, actual: [10, 10, 10] } })
    const history = [makeEntry([makeLog({ weight: 60, series: 3, reps: { expected: 10, actual: [10, 10, 10] } })])]
    expect(detectPR(current, history)).toBe(false)
  })
})
