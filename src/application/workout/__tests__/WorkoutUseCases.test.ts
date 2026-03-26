import { describe, it, expect, vi } from 'vitest'
import { StartWorkoutUseCase, RecordSeriesUseCase, CompleteWorkoutUseCase } from '../WorkoutUseCases'
import type { DB } from '../../../domain/shared/DB'

const stubExercises = {
  curl_biceps: { id: 'curl_biceps', name: 'Curl de bíceps' },
}

const stubDB: DB = {
  auth: { username: 'carlos', passwordHash: 'hash' },
  exercises: stubExercises,
  routines: { LUNES: ['curl_biceps'], MIERCOLES: [], VIERNES: [] },
  history: [],
}

function makeStorage(db: DB = stubDB) {
  return {
    load: vi.fn().mockReturnValue(db),
    save: vi.fn(),
  }
}

describe('StartWorkoutUseCase', () => {
  it('crea una entrada de historial con los logs del día', () => {
    const storage = makeStorage()
    const sut = new StartWorkoutUseCase(storage as never)

    const entry = sut.execute('LUNES', '2026-01-06')
    expect(entry.type).toBe('LUNES')
    expect(entry.date).toBe('2026-01-06')
    expect(entry.completed).toBe(false)
    expect(entry.logs).toHaveLength(1)
    expect(entry.logs[0].exercise_id).toBe('curl_biceps')
  })

  it('usa los últimos valores del historial del mismo día', () => {
    const dbWithHistory: DB = {
      ...stubDB,
      history: [{
        date: '2025-12-30',
        type: 'LUNES',
        completed: true,
        logs: [{ exercise_id: 'curl_biceps', name: 'Curl de bíceps', series: 4, reps: { expected: 12, actual: [12, 12, 12, 12] }, weight: 20 }],
      }],
    }
    const storage = makeStorage(dbWithHistory)
    const sut = new StartWorkoutUseCase(storage as never)

    const entry = sut.execute('LUNES', '2026-01-06')
    expect(entry.logs[0].series).toBe(4)
    expect(entry.logs[0].reps.expected).toBe(12)
    expect(entry.logs[0].weight).toBe(20)
  })

  it('usa valores por defecto (3 series, 10 reps, 0 kg) si no hay historial', () => {
    const storage = makeStorage()
    const sut = new StartWorkoutUseCase(storage as never)

    const entry = sut.execute('LUNES', '2026-01-06')
    expect(entry.logs[0].series).toBe(3)
    expect(entry.logs[0].reps.expected).toBe(10)
    expect(entry.logs[0].weight).toBe(0)
  })

  it('guarda la entrada en el historial y persiste', () => {
    const storage = makeStorage()
    const sut = new StartWorkoutUseCase(storage as never)

    sut.execute('LUNES', '2026-01-06')
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({ history: expect.arrayContaining([expect.objectContaining({ type: 'LUNES' })]) })
    )
  })
})

describe('RecordSeriesUseCase', () => {
  it('actualiza reps.actual del ejercicio indicado en la entrada de hoy', () => {
    const todayEntry = {
      date: '2026-01-06',
      type: 'LUNES' as const,
      completed: false,
      logs: [{ exercise_id: 'curl_biceps', name: 'Curl', series: 3, reps: { expected: 10, actual: [null, null, null] as (number | null)[] }, weight: 20 }],
    }
    const db: DB = { ...stubDB, history: [todayEntry] }
    const storage = makeStorage(db)
    const sut = new RecordSeriesUseCase(storage as never)

    sut.execute('2026-01-06', 'curl_biceps', 0, 10)
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        history: expect.arrayContaining([
          expect.objectContaining({
            logs: expect.arrayContaining([
              expect.objectContaining({ reps: expect.objectContaining({ actual: [10, null, null] }) }),
            ]),
          }),
        ]),
      })
    )
  })
})

describe('CompleteWorkoutUseCase', () => {
  it('marca la entrada de hoy como completed', () => {
    const todayEntry = {
      date: '2026-01-06', type: 'LUNES' as const, completed: false,
      logs: [{ exercise_id: 'curl_biceps', name: 'Curl', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 20 }],
    }
    const storage = makeStorage({ ...stubDB, history: [todayEntry] })
    const sut = new CompleteWorkoutUseCase(storage as never)

    sut.execute('2026-01-06')
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        history: expect.arrayContaining([expect.objectContaining({ completed: true })]),
      })
    )
  })
})
