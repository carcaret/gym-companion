import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { HistorialView } from '../HistorialView'
import type { DB } from '../../../../domain/shared/DB'

const testDB: DB = {
  auth: { username: 'test', passwordHash: 'hash' },
  exercises: {},
  routines: { LUNES: [], MIERCOLES: [], VIERNES: [] },
  history: [
    {
      date: '2026-03-23',
      type: 'LUNES',
      completed: true,
      logs: [
        {
          exercise_id: 'press_banca',
          name: 'Press de Banca',
          series: 4,
          reps: { expected: 10, actual: [10, 9, 8, 10] },
          weight: 80,
        },
        {
          exercise_id: 'curl_biceps',
          name: 'Curl de Bíceps',
          series: 3,
          reps: { expected: 12, actual: [12, 11, 10] },
          weight: 20,
        },
      ],
    },
    {
      date: '2026-03-21',
      type: 'VIERNES',
      completed: true,
      logs: [
        {
          exercise_id: 'sentadilla',
          name: 'Sentadilla',
          series: 3,
          reps: { expected: 8, actual: [8, 8, 7] },
          weight: 100,
        },
      ],
    },
  ],
}

function HistWrapper({ initialDB = testDB }: { initialDB?: DB }) {
  const [db, setDB] = useState(initialDB)
  return (
    <HistorialView
      db={db}
      onUpdateDB={(updater) => setDB((prev) => updater(prev))}
      onModalRequest={vi.fn()}
    />
  )
}

// ── Lista compacta (tests 26-27) ─────────────────────────────────────

describe('HistorialView — lista compacta', () => {
  it('muestra cards con fecha, tipo badge y N ejercicios', () => {
    render(<HistWrapper />)
    // Sorted by date desc: 2026-03-23 first, then 2026-03-21
    expect(screen.getByText('2026-03-23')).toBeInTheDocument()
    expect(screen.getByText('2026-03-21')).toBeInTheDocument()
    // Type badges inside cards (filter bar also has "Lunes"/"Viernes")
    const cards = document.querySelectorAll('.history-card')
    expect(cards).toHaveLength(2)
    expect(cards[0].textContent).toMatch(/Lunes/)
    expect(cards[0].textContent).toMatch(/2 ejercicios/)
    expect(cards[1].textContent).toMatch(/Viernes/)
    expect(cards[1].textContent).toMatch(/1 ejercicios/)
  })

  it('cada card tiene botón 🗑️', () => {
    render(<HistWrapper />)
    const deleteButtons = screen.getAllByTitle('Borrar')
    expect(deleteButtons).toHaveLength(2)
  })
})

// ── Navegación lista → detalle (tests 28-30) ────────────────────────

describe('HistorialView — navegación a detalle', () => {
  it('click en card navega a vista de detalle (WorkoutDetailView aparece)', async () => {
    render(<HistWrapper />)
    // Click on the first history card header
    await userEvent.click(screen.getByText('2026-03-23'))
    // Should now show exercise cards from WorkoutDetailView
    expect(screen.getByText('Press de Banca')).toBeInTheDocument()
    expect(screen.getByText('Curl de Bíceps')).toBeInTheDocument()
    // The list should be hidden
    expect(screen.queryByText('2026-03-21')).not.toBeInTheDocument()
  })

  it('vista detalle muestra botón "← Volver"', async () => {
    render(<HistWrapper />)
    await userEvent.click(screen.getByText('2026-03-23'))
    expect(screen.getByRole('button', { name: /volver/i })).toBeInTheDocument()
  })

  it('click en "← Volver" vuelve a la lista', async () => {
    render(<HistWrapper />)
    await userEvent.click(screen.getByText('2026-03-23'))
    expect(screen.queryByText('2026-03-21')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /volver/i }))
    // Back to list — both entries visible
    expect(screen.getByText('2026-03-23')).toBeInTheDocument()
    expect(screen.getByText('2026-03-21')).toBeInTheDocument()
  })
})

// ── Detalle: edición y restricciones (tests 31-32) ──────────────────

describe('HistorialView — detalle edición', () => {
  it('en detalle se puede editar (✏️ → controles de edición)', async () => {
    render(<HistWrapper />)
    await userEvent.click(screen.getByText('2026-03-23'))
    // Should have edit button
    await userEvent.click(screen.getByTitle('Editar'))
    // After activating edit, param-rows should have btn-icon buttons
    const body0 = document.getElementById('body-0')!
    const paramButtons = body0.querySelectorAll('.param-row button.btn-icon')
    expect(paramButtons.length).toBeGreaterThan(0)
  })

  it('no hay botón "+ Ejercicio" ni "Quitar de rutina" en detalle desde historial', async () => {
    render(<HistWrapper />)
    await userEvent.click(screen.getByText('2026-03-23'))
    expect(screen.queryByRole('button', { name: /\+ ejercicio/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /quitar de rutina/i })).not.toBeInTheDocument()
  })
})

// ── Edición completa (mantener de tests anteriores) ─────────────────

describe('HistorialView — auto-propagación en detalle', () => {
  it('al cambiar reps obj, las reps reales se actualizan al nuevo valor', async () => {
    render(<HistWrapper />)
    // Navigate to detail
    await userEvent.click(screen.getByText('2026-03-23'))
    // Activate edit
    await userEvent.click(screen.getByTitle('Editar'))
    const body0 = document.getElementById('body-0')!
    // Reps obj row is the third param-row, click + button
    const paramRows = body0.querySelectorAll('.param-row')
    const repsRow = paramRows[2]
    const plusBtn = repsRow.querySelectorAll('button.btn-icon')[1]
    await userEvent.click(plusBtn)
    // Expected was 10, now 11. All actual reps should be 11
    const seriesInputs = body0.querySelectorAll<HTMLInputElement>('.series-row input')
    for (const input of seriesInputs) {
      expect(input.value).toBe('11')
    }
  })
})
