import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SeriesRow } from '../components/SeriesRow'
import { WorkoutCard } from '../components/WorkoutCard'
import { WorkoutView } from '../WorkoutView'
import type { HistoryEntry } from '../../../../domain/shared/DB'

// ── SeriesRow ──
describe('SeriesRow', () => {
  it('muestra los reps esperados como valor inicial cuando actual es null', () => {
    render(<SeriesRow index={0} expected={10} actual={null} onUpdate={vi.fn()} />)
    expect(screen.getByRole('spinbutton')).toHaveValue(10)
  })

  it('llama onUpdate con el nuevo valor al cambiar el input', async () => {
    const onUpdate = vi.fn()
    render(<SeriesRow index={0} expected={10} actual={null} onUpdate={onUpdate} />)
    await userEvent.tripleClick(screen.getByRole('spinbutton'))
    await userEvent.keyboard('8')
    expect(onUpdate).toHaveBeenCalledWith(0, 8)
  })
})

// ── WorkoutCard ──
const stubLog = {
  exercise_id: 'curl',
  name: 'Curl de bíceps',
  series: 3,
  reps: { expected: 10, actual: [null, null, null] as (number | null)[] },
  weight: 60,
}

describe('WorkoutCard', () => {
  it('renderiza una fila por serie', () => {
    render(<WorkoutCard log={stubLog} isPR={false} onSeriesUpdate={vi.fn()} />)
    expect(screen.getAllByRole('spinbutton')).toHaveLength(3)
  })

  it('muestra el badge PR cuando isPR es true', () => {
    render(<WorkoutCard log={stubLog} isPR={true} onSeriesUpdate={vi.fn()} />)
    expect(screen.getByText(/pr/i)).toBeInTheDocument()
  })

  it('no muestra el badge PR cuando isPR es false', () => {
    render(<WorkoutCard log={stubLog} isPR={false} onSeriesUpdate={vi.fn()} />)
    expect(screen.queryByText(/🏆/)).not.toBeInTheDocument()
  })
})

// ── WorkoutView ──
const noEntry: HistoryEntry | null = null
const activeEntry: HistoryEntry = {
  date: '2026-01-06', type: 'LUNES', completed: false,
  logs: [stubLog],
}
const completedEntry: HistoryEntry = { ...activeEntry, completed: true }

describe('WorkoutView', () => {
  it('muestra botón para iniciar entreno cuando no hay entrada hoy', () => {
    render(<WorkoutView entry={noEntry} dayType="LUNES" onStart={vi.fn()} onSeriesUpdate={vi.fn()} onComplete={vi.fn()} />)
    expect(screen.getByRole('button', { name: /iniciar/i })).toBeInTheDocument()
  })

  it('llama onStart al pulsar iniciar', async () => {
    const onStart = vi.fn()
    render(<WorkoutView entry={noEntry} dayType="LUNES" onStart={onStart} onSeriesUpdate={vi.fn()} onComplete={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /iniciar/i }))
    expect(onStart).toHaveBeenCalled()
  })

  it('muestra los ejercicios del día cuando el entreno está activo', () => {
    render(<WorkoutView entry={activeEntry} dayType="LUNES" onStart={vi.fn()} onSeriesUpdate={vi.fn()} onComplete={vi.fn()} />)
    expect(screen.getByText('Curl de bíceps')).toBeInTheDocument()
  })

  it('muestra botón finalizar entreno cuando está activo', () => {
    render(<WorkoutView entry={activeEntry} dayType="LUNES" onStart={vi.fn()} onSeriesUpdate={vi.fn()} onComplete={vi.fn()} />)
    expect(screen.getByRole('button', { name: /finalizar/i })).toBeInTheDocument()
  })

  it('muestra estado completado cuando el entreno está completado', () => {
    render(<WorkoutView entry={completedEntry} dayType="LUNES" onStart={vi.fn()} onSeriesUpdate={vi.fn()} onComplete={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /completado/i })).toBeInTheDocument()
  })
})
