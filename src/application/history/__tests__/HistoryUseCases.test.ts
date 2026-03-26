import { describe, it, expect, vi } from 'vitest'
import { GetHistoryUseCase, FilterHistoryUseCase } from '../HistoryUseCases'
import type { HistoryEntry } from '../../../domain/shared/DB'

const entries: HistoryEntry[] = [
  { date: '2026-01-05', type: 'LUNES', completed: true, logs: [] },
  { date: '2026-01-07', type: 'MIERCOLES', completed: true, logs: [] },
  { date: '2026-01-09', type: 'VIERNES', completed: true, logs: [] },
  { date: '2026-01-12', type: 'LUNES', completed: true, logs: [] },
]

function makeStorage() {
  return { load: vi.fn().mockReturnValue({ history: entries }) }
}

describe('GetHistoryUseCase', () => {
  it('devuelve el historial ordenado de más reciente a más antiguo', () => {
    const sut = new GetHistoryUseCase(makeStorage() as never)
    const result = sut.execute()
    expect(result[0].date).toBe('2026-01-12')
    expect(result[result.length - 1].date).toBe('2026-01-05')
  })
})

describe('FilterHistoryUseCase', () => {
  it('devuelve todas las entradas cuando el filtro es null', () => {
    const sut = new FilterHistoryUseCase(makeStorage() as never)
    expect(sut.execute(null)).toHaveLength(4)
  })

  it('filtra por LUNES', () => {
    const sut = new FilterHistoryUseCase(makeStorage() as never)
    const result = sut.execute('LUNES')
    expect(result).toHaveLength(2)
    expect(result.every((e) => e.type === 'LUNES')).toBe(true)
  })
})
