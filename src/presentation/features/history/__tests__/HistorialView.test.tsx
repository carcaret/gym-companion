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
    // El número objetivo es 10; debería aparecer en el contexto de reps
    const content = document.querySelector('#h-body-0')?.textContent ?? ''
    expect(content).toMatch(/obj.*10|10.*obj/i)
  })

  it('muestra las reps reales cuando existen', () => {
    render(<HistWrapper />)
    const content = document.querySelector('#h-body-0')?.textContent ?? ''
    // actual: [10, 9, 8, 10] → debería contener "9" o "8" (valores reales)
    expect(content).toMatch(/9/)
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
    // No debería tener "real:" si no hay reps reales
    expect(content).not.toMatch(/real:/i)
  })
})
