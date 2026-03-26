import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HistoryView } from '../HistoryView'
import type { HistoryEntry } from '../../../../domain/shared/DB'

const entries: HistoryEntry[] = [
  { date: '2026-01-05', type: 'LUNES', completed: true, logs: [{ exercise_id: 'curl', name: 'Curl', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 60 }] },
  { date: '2026-01-07', type: 'MIERCOLES', completed: true, logs: [] },
]

describe('HistoryView', () => {
  it('muestra todas las entradas por defecto', () => {
    render(<HistoryView entries={entries} onFilter={vi.fn()} activeFilter={null} />)
    expect(screen.getByText('2026-01-05')).toBeInTheDocument()
    expect(screen.getByText('2026-01-07')).toBeInTheDocument()
  })

  it('muestra estado vacío cuando no hay entrenamientos', () => {
    render(<HistoryView entries={[]} onFilter={vi.fn()} activeFilter={null} />)
    expect(screen.getByText(/sin entrenamientos/i)).toBeInTheDocument()
  })

  it('expande el detalle al hacer click en una entrada', async () => {
    render(<HistoryView entries={entries} onFilter={vi.fn()} activeFilter={null} />)
    await userEvent.click(screen.getByText('2026-01-05'))
    expect(screen.getByText(/curl/i)).toBeInTheDocument()
  })
})

describe('HistoryFilter', () => {
  it('renderiza botones TODOS, LUNES, MIERCOLES, VIERNES', () => {
    render(<HistoryView entries={[]} onFilter={vi.fn()} activeFilter={null} />)
    expect(screen.getByRole('button', { name: /todos/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /lunes/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /miércoles/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /viernes/i })).toBeInTheDocument()
  })

  it('llama onFilter con "LUNES" al hacer click en Lunes', async () => {
    const onFilter = vi.fn()
    render(<HistoryView entries={[]} onFilter={onFilter} activeFilter={null} />)
    await userEvent.click(screen.getByRole('button', { name: /lunes/i }))
    expect(onFilter).toHaveBeenCalledWith('LUNES')
  })

  it('llama onFilter con null al hacer click en Todos', async () => {
    const onFilter = vi.fn()
    render(<HistoryView entries={[]} onFilter={onFilter} activeFilter={null} />)
    await userEvent.click(screen.getByRole('button', { name: /todos/i }))
    expect(onFilter).toHaveBeenCalledWith(null)
  })
})
