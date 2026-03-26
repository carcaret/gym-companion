import { describe, it, expect, vi } from 'vitest'
import { GetChartDataUseCase } from '../GetChartDataUseCase'
import type { DB } from '../../../domain/shared/DB'

const stubDB: DB = {
  auth: { username: 'carlos', passwordHash: 'hash' },
  exercises: { curl_biceps: { id: 'curl_biceps', name: 'Curl de bíceps' } },
  routines: { LUNES: [], MIERCOLES: [], VIERNES: [] },
  history: [
    {
      date: '2026-01-05',
      type: 'LUNES',
      completed: true,
      logs: [{ exercise_id: 'curl_biceps', name: 'Curl', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 60 }],
    },
    {
      date: '2026-01-12',
      type: 'LUNES',
      completed: true,
      logs: [{ exercise_id: 'curl_biceps', name: 'Curl', series: 3, reps: { expected: 10, actual: [12, 12, 12] }, weight: 65 }],
    },
  ],
}

describe('GetChartDataUseCase', () => {
  it('devuelve puntos de volumen para el ejercicio indicado', () => {
    const sut = new GetChartDataUseCase({ load: vi.fn().mockReturnValue(stubDB) } as never)
    const result = sut.execute('curl_biceps', null, null)
    expect(result.volume).toHaveLength(2)
    expect(result.volume[0].x).toBe('2026-01-05')
    expect(result.volume[0].y).toBe(1800) // 60 * 3 * 10
  })

  it('devuelve puntos de e1RM para el ejercicio indicado', () => {
    const sut = new GetChartDataUseCase({ load: vi.fn().mockReturnValue(stubDB) } as never)
    const result = sut.execute('curl_biceps', null, null)
    expect(result.e1rm).toHaveLength(2)
    expect(result.e1rm[0].y).toBeCloseTo(80) // 60 * (1 + 10/30) = 80
  })

  it('filtra por rango de fechas cuando se especifica', () => {
    const sut = new GetChartDataUseCase({ load: vi.fn().mockReturnValue(stubDB) } as never)
    const result = sut.execute('curl_biceps', '2026-01-10', '2026-01-15')
    expect(result.volume).toHaveLength(1)
    expect(result.volume[0].x).toBe('2026-01-12')
  })

  it('devuelve arrays vacíos si no hay datos del ejercicio', () => {
    const sut = new GetChartDataUseCase({ load: vi.fn().mockReturnValue(stubDB) } as never)
    const result = sut.execute('press_banca', null, null)
    expect(result.volume).toHaveLength(0)
    expect(result.e1rm).toHaveLength(0)
  })
})
