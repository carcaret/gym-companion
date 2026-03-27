import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { WorkoutDetailView } from '../WorkoutDetailView'
import type { DB, HistoryEntry } from '../../../../domain/shared/DB'

// ── Test data ─────────────────────────────────────────────────────────

const baseDB: DB = {
  auth: { username: 'test', passwordHash: 'hash' },
  exercises: {
    press_banca: { id: 'press_banca', name: 'Press de Banca' },
    curl_biceps: { id: 'curl_biceps', name: 'Curl de Bíceps' },
  },
  routines: { LUNES: ['press_banca', 'curl_biceps'], MIERCOLES: [], VIERNES: [] },
  history: [],
}

const activeEntry: HistoryEntry = {
  date: '2026-03-23',
  type: 'LUNES',
  completed: false,
  logs: [
    { exercise_id: 'press_banca', name: 'Press de Banca', series: 3, reps: { expected: 10, actual: [null, null, null] }, weight: 80 },
    { exercise_id: 'curl_biceps', name: 'Curl de Bíceps', series: 3, reps: { expected: 10, actual: [null, null, null] }, weight: 20 },
  ],
}

const completedEntry: HistoryEntry = {
  date: '2026-03-23',
  type: 'LUNES',
  completed: true,
  logs: [
    { exercise_id: 'press_banca', name: 'Press de Banca', series: 4, reps: { expected: 8, actual: [8, 8, 7, 6] }, weight: 80 },
    { exercise_id: 'curl_biceps', name: 'Curl de Bíceps', series: 3, reps: { expected: 10, actual: [10, 9, 8] }, weight: 20 },
  ],
}

// ── Wrapper with state ────────────────────────────────────────────────

function DetailWrapper({
  entry,
  canAddRemoveExercises = false,
  canFinishWorkout = false,
  onBack,
  onModalRequest = vi.fn(),
}: {
  entry: HistoryEntry
  canAddRemoveExercises?: boolean
  canFinishWorkout?: boolean
  onBack?: () => void
  onModalRequest?: (state: unknown) => void
}) {
  const [db, setDB] = useState<DB>({ ...baseDB, history: [entry] })
  const currentEntry = db.history.find((h) => h.date === entry.date)!
  return (
    <WorkoutDetailView
      db={db}
      entry={currentEntry}
      onUpdateDB={(updater) => setDB((prev) => updater(prev))}
      canAddRemoveExercises={canAddRemoveExercises}
      canFinishWorkout={canFinishWorkout}
      onModalRequest={onModalRequest}
      onBack={onBack}
    />
  )
}

// ── Grupo A: Renderizado básico ───────────────────────────────────────

describe('WorkoutDetailView — renderizado básico', () => {
  it('renderiza un card por cada ejercicio del entry', () => {
    render(<DetailWrapper entry={activeEntry} />)
    expect(document.getElementById('exercise-card-0')).toBeInTheDocument()
    expect(document.getElementById('exercise-card-1')).toBeInTheDocument()
  })

  it('muestra el nombre de cada ejercicio en los cards', () => {
    render(<DetailWrapper entry={activeEntry} />)
    expect(screen.getByText('Press de Banca')).toBeInTheDocument()
    expect(screen.getByText('Curl de Bíceps')).toBeInTheDocument()
  })

  it('los cards son colapsables (click en header toglea open)', async () => {
    render(<DetailWrapper entry={completedEntry} />)
    const body0 = document.getElementById('body-0')!
    expect(body0).not.toHaveClass('open')
    // Click header to expand
    const header = body0.closest('.card')!.querySelector('.card-header')!
    await userEvent.click(header)
    expect(body0).toHaveClass('open')
    // Click again to collapse
    await userEvent.click(header)
    expect(body0).not.toHaveClass('open')
  })
})

// ── Grupo B: Entreno activo (no completado) ───────────────────────────

describe('WorkoutDetailView — entreno activo', () => {
  it('cards empiezan expandidos automáticamente', () => {
    render(<DetailWrapper entry={activeEntry} />)
    expect(document.getElementById('body-0')).toHaveClass('open')
    expect(document.getElementById('body-1')).toHaveClass('open')
  })

  it('modo edición activo por defecto (hay btn-icon en param-rows)', () => {
    render(<DetailWrapper entry={activeEntry} />)
    const body0 = document.getElementById('body-0')!
    const paramButtons = body0.querySelectorAll('.param-row button.btn-icon')
    expect(paramButtons.length).toBeGreaterThan(0)
  })

  it('muestra botón "Finalizar entreno" cuando canFinishWorkout=true', () => {
    render(<DetailWrapper entry={activeEntry} canFinishWorkout={true} />)
    expect(screen.getByRole('button', { name: /finalizar entreno/i })).toBeInTheDocument()
  })

  it('no muestra "Finalizar entreno" cuando canFinishWorkout=false', () => {
    render(<DetailWrapper entry={activeEntry} canFinishWorkout={false} />)
    expect(screen.queryByRole('button', { name: /finalizar entreno/i })).not.toBeInTheDocument()
  })
})

// ── Grupo C: Entreno completado, modo view ────────────────────────────

describe('WorkoutDetailView — completado, modo view', () => {
  it('cards empiezan colapsados', () => {
    render(<DetailWrapper entry={completedEntry} />)
    expect(document.getElementById('body-0')).not.toHaveClass('open')
  })

  it('no hay botones btn-icon dentro de param-rows (read-only)', () => {
    render(<DetailWrapper entry={completedEntry} />)
    const body0 = document.getElementById('body-0')!
    const paramButtons = body0.querySelectorAll('.param-row button.btn-icon')
    expect(paramButtons).toHaveLength(0)
  })

  it('hay botón ✏️ para activar edición', () => {
    render(<DetailWrapper entry={completedEntry} />)
    expect(screen.getByTitle('Editar')).toBeInTheDocument()
  })

  it('muestra reps reales en fila "Reales" dentro del body (cuando se expande)', async () => {
    render(<DetailWrapper entry={completedEntry} />)
    // Expand card 0
    const header = document.getElementById('body-0')!.closest('.card')!.querySelector('.card-header')!
    await userEvent.click(header)
    const body0 = document.getElementById('body-0')!
    expect(body0.textContent).toMatch(/Reales/)
    expect(body0.textContent).toMatch(/8, 8, 7, 6/)
  })
})

// ── Grupo D: Entreno completado, modo edit ────────────────────────────

describe('WorkoutDetailView — completado, modo edit', () => {
  it('al pulsar ✏️, aparecen btn-icon en param-rows', async () => {
    render(<DetailWrapper entry={completedEntry} />)
    await userEvent.click(screen.getByTitle('Editar'))
    const body0 = document.getElementById('body-0')!
    const paramButtons = body0.querySelectorAll('.param-row button.btn-icon')
    expect(paramButtons.length).toBeGreaterThan(0)
  })

  it('al pulsar ✅ (toggle off), desaparecen btn-icon', async () => {
    render(<DetailWrapper entry={completedEntry} />)
    // Activate edit
    await userEvent.click(screen.getByTitle('Editar'))
    expect(document.querySelector('.param-row button.btn-icon')).toBeInTheDocument()
    // Deactivate edit
    await userEvent.click(screen.getByTitle('Editar'))
    const body0 = document.getElementById('body-0')!
    expect(body0.querySelectorAll('.param-row button.btn-icon')).toHaveLength(0)
  })

  it('click + peso llama onUpdateDB con weight incrementado', async () => {
    render(<DetailWrapper entry={completedEntry} />)
    await userEvent.click(screen.getByTitle('Editar'))
    const body0 = document.getElementById('body-0')!
    // First param-row is Peso
    const pesoRow = body0.querySelectorAll('.param-row')[0]
    const plusBtn = pesoRow.querySelectorAll('button.btn-icon')[1]
    await userEvent.click(plusBtn)
    // Weight was 80, now should be 82.5
    const input = pesoRow.querySelector('.param-input') as HTMLInputElement
    expect(input.value).toBe('82.5')
  })

  it('auto-propagación: click + reps obj actualiza todas las reps reales', async () => {
    render(<DetailWrapper entry={completedEntry} />)
    await userEvent.click(screen.getByTitle('Editar'))
    const body0 = document.getElementById('body-0')!
    // Reps obj is the third param-row
    const paramRows = body0.querySelectorAll('.param-row')
    const repsRow = paramRows[2]
    const plusBtn = repsRow.querySelectorAll('button.btn-icon')[1]
    await userEvent.click(plusBtn)
    // Expected was 8, now 9. All actual reps should be 9
    const seriesInputs = body0.querySelectorAll<HTMLInputElement>('.series-row input')
    for (const input of seriesInputs) {
      expect(input.value).toBe('9')
    }
  })
})

// ── Grupo E: Capacidades opcionales ───────────────────────────────────

describe('WorkoutDetailView — capacidades opcionales', () => {
  it('canAddRemoveExercises=true: muestra "+ Ejercicio" y "Quitar de rutina"', () => {
    render(<DetailWrapper entry={activeEntry} canAddRemoveExercises={true} />)
    expect(screen.getByRole('button', { name: /\+ ejercicio/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /quitar de rutina/i }).length).toBeGreaterThan(0)
  })

  it('canAddRemoveExercises=false: no muestra ni "+ Ejercicio" ni "Quitar de rutina"', () => {
    render(<DetailWrapper entry={activeEntry} canAddRemoveExercises={false} />)
    expect(screen.queryByRole('button', { name: /\+ ejercicio/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /quitar de rutina/i })).not.toBeInTheDocument()
  })

  it('onBack presente: muestra botón "← Volver"', () => {
    render(<DetailWrapper entry={completedEntry} onBack={vi.fn()} />)
    expect(screen.getByRole('button', { name: /volver/i })).toBeInTheDocument()
  })

  it('onBack ausente: no muestra botón volver', () => {
    render(<DetailWrapper entry={completedEntry} />)
    expect(screen.queryByRole('button', { name: /volver/i })).not.toBeInTheDocument()
  })

  it('click en "← Volver" llama onBack()', async () => {
    const onBack = vi.fn()
    render(<DetailWrapper entry={completedEntry} onBack={onBack} />)
    await userEvent.click(screen.getByRole('button', { name: /volver/i }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
