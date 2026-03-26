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

// ── Bug 2a: Botones +/− condicionales a modo edición ─────────────────

describe('HistorialView — botones +/− solo en edición (Bug 2)', () => {
  it('no hay botones +/− en las filas de parámetros cuando no se edita', () => {
    render(<HistWrapper />)
    // Los botones en .param-row sólo deben existir en edición
    const paramButtons = document.querySelectorAll('.param-row button.btn-icon')
    expect(paramButtons).toHaveLength(0)
  })

  it('aparecen botones +/− en param-rows al activar edición', async () => {
    render(<HistWrapper />)
    const editBtn = screen.getByTitle('Editar')
    await userEvent.click(editBtn)
    const paramButtons = document.querySelectorAll('.param-row button.btn-icon')
    expect(paramButtons.length).toBeGreaterThan(0)
  })

  it('desaparecen los botones +/− al desactivar edición', async () => {
    render(<HistWrapper />)
    const editBtn = screen.getByTitle('Editar')
    // Activar
    await userEvent.click(editBtn)
    expect(document.querySelectorAll('.param-row button.btn-icon').length).toBeGreaterThan(0)
    // Desactivar
    await userEvent.click(editBtn)
    expect(document.querySelectorAll('.param-row button.btn-icon')).toHaveLength(0)
  })
})

// ── Bug 2b: Formato de reps ──────────────────────────────────────────

describe('HistorialView — formato de reps (Bug 2)', () => {
  it('muestra las reps objetivo (expected)', () => {
    render(<HistWrapper />)
    const content = document.querySelector('#h-body-0')?.textContent ?? ''
    expect(content).toMatch(/Reps obj/)
    expect(content).toMatch(/10/)
  })

  it('muestra las reps reales en fila separada cuando existen', () => {
    render(<HistWrapper />)
    const content = document.querySelector('#h-body-0')?.textContent ?? ''
    expect(content).toMatch(/Reales/)
    expect(content).toMatch(/10, 9, 8, 10/)
  })

  it('sólo muestra objetivo cuando no hay reps reales registradas', () => {
    const dbSinReales: DB = {
      ...testDB,
      history: [
        {
          ...testDB.history[0],
          logs: [{ ...testDB.history[0].logs[0], reps: { expected: 12, actual: [] } }],
        },
      ],
    }
    render(<HistWrapper initialDB={dbSinReales} />)
    const content = document.querySelector('#h-body-0')?.textContent ?? ''
    expect(content).toMatch(/12/)
    expect(content).not.toMatch(/Reales/)
  })
})

// ── Edición completa: reps obj, reps reales, auto-propagación ────────

describe('HistorialView — edición completa', () => {
  it('en modo edición aparecen controles de reps obj (+/-)', async () => {
    render(<HistWrapper />)
    await userEvent.click(screen.getByTitle('Editar'))
    const body = document.getElementById('h-body-0')!
    // Should have a param-row for Reps obj. with +/- buttons
    const paramRows = body.querySelectorAll('.param-row')
    const repsRow = paramRows[2] // Peso, Series, Reps obj.
    const buttons = repsRow.querySelectorAll('button.btn-icon')
    expect(buttons).toHaveLength(2)
  })

  it('en modo edición aparecen inputs por serie con +/-', async () => {
    render(<HistWrapper />)
    await userEvent.click(screen.getByTitle('Editar'))
    const body = document.getElementById('h-body-0')!
    const seriesInputs = body.querySelectorAll('.series-row input')
    expect(seriesInputs).toHaveLength(4) // 4 series in testDB
    const seriesButtons = body.querySelectorAll('.series-row button.btn-icon')
    expect(seriesButtons).toHaveLength(8) // 4 × 2
  })

  it('al cambiar reps obj, las reps reales se actualizan al nuevo valor', async () => {
    render(<HistWrapper />)
    await userEvent.click(screen.getByTitle('Editar'))
    const body = document.getElementById('h-body-0')!
    // Reps obj row is the third param-row, click + button
    const paramRows = body.querySelectorAll('.param-row')
    const repsRow = paramRows[2]
    const plusBtn = repsRow.querySelectorAll('button.btn-icon')[1]
    await userEvent.click(plusBtn)
    // Expected was 10, now 11. All actual reps should be 11
    const seriesInputs = body.querySelectorAll<HTMLInputElement>('.series-row input')
    for (const input of seriesInputs) {
      expect(input.value).toBe('11')
    }
  })

  it('el body muestra ejercicios con .exercise-name, peso, series, reps obj y reps reales', () => {
    render(<HistWrapper />)
    const body = document.getElementById('h-body-0')!
    // exercise-name
    expect(body.querySelector('.exercise-name')).toBeInTheDocument()
    expect(body.querySelector('.exercise-name')!.textContent).toBe('Press de Banca')
    // params
    const text = body.textContent!
    expect(text).toMatch(/Peso/)
    expect(text).toMatch(/80/)
    expect(text).toMatch(/Series/)
    expect(text).toMatch(/4/)
    expect(text).toMatch(/Reps obj/)
    expect(text).toMatch(/10/)
    expect(text).toMatch(/Reales/)
    expect(text).toMatch(/10, 9, 8, 10/)
  })
})
