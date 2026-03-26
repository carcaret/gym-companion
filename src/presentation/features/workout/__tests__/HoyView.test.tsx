import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { HoyView } from '../HoyView'
import type { DB, DayOfWeek } from '../../../../domain/shared/DB'

const testDB: DB = {
  auth: { username: 'test', passwordHash: 'hash' },
  exercises: {
    press_banca: { id: 'press_banca', name: 'Press de Banca' },
    curl_biceps: { id: 'curl_biceps', name: 'Curl de Bíceps' },
  },
  routines: { LUNES: ['press_banca', 'curl_biceps'], MIERCOLES: [], VIERNES: [] },
  history: [
    {
      date: '2026-03-16',
      type: 'LUNES',
      completed: true,
      logs: [
        { exercise_id: 'press_banca', name: 'Press de Banca', series: 4, reps: { expected: 8, actual: [8, 8, 8, 7] }, weight: 80 },
        { exercise_id: 'curl_biceps', name: 'Curl de Bíceps', series: 3, reps: { expected: 10, actual: [10, 9, 8] }, weight: 20 },
      ],
    },
  ],
}

const activeWorkoutDB: DB = {
  ...testDB,
  history: [
    ...testDB.history,
    {
      date: '2026-03-23',
      type: 'LUNES',
      completed: false,
      logs: [
        { exercise_id: 'press_banca', name: 'Press de Banca', series: 3, reps: { expected: 10, actual: [null, null, null] }, weight: 80 },
        { exercise_id: 'curl_biceps', name: 'Curl de Bíceps', series: 3, reps: { expected: 10, actual: [null, null, null] }, weight: 20 },
      ],
    },
  ],
}

function HoyWrapper({
  initialDB = testDB,
  todayStr = '2026-03-23',
  dayType = 'LUNES' as DayOfWeek,
}: {
  initialDB?: DB
  todayStr?: string
  dayType?: DayOfWeek | null
}) {
  const [db, setDB] = useState(initialDB)
  return (
    <HoyView
      db={db}
      todayStr={todayStr}
      dayType={dayType}
      onUpdateDB={(updater) => setDB((prev) => updater(prev))}
      onModalRequest={vi.fn()}
    />
  )
}

// ── Bug 1a: Preview no usa lista nativa ──────────────────────────────

describe('HoyView — preview de rutina (Bug 1)', () => {
  it('no renderiza elementos <li> en el preview', () => {
    render(<HoyWrapper />)
    expect(document.querySelectorAll('li')).toHaveLength(0)
  })

  it('muestra los nombres de los ejercicios de la rutina', () => {
    render(<HoyWrapper />)
    expect(screen.getByText('Press de Banca')).toBeInTheDocument()
    expect(screen.getByText('Curl de Bíceps')).toBeInTheDocument()
  })

  it('muestra el último peso conocido para cada ejercicio', () => {
    render(<HoyWrapper />)
    // testDB tiene press_banca con weight=80 en el último entreno de LUNES
    expect(screen.getAllByText(/80/).length).toBeGreaterThan(0)
  })

  it('no muestra "kg" cuando el peso es 0 (primer entreno)', () => {
    const dbSinHistorial: DB = { ...testDB, history: [] }
    render(<HoyWrapper initialDB={dbSinHistorial} />)
    expect(screen.queryByText(/\b0\s*kg\b/)).not.toBeInTheDocument()
  })

  it('muestra series y reps del último entreno en el preview', () => {
    render(<HoyWrapper />)
    // press_banca: 4 series × 8 reps en el último LUNES
    const previewContent = document.getElementById('workout-preview')!.textContent ?? ''
    expect(previewContent).toMatch(/4/)
    expect(previewContent).toMatch(/8/)
  })
})

// ── Bug 1b: Auto-expand de tarjetas ──────────────────────────────────

describe('HoyView — auto-expand de tarjetas (Bug 1)', () => {
  it('las tarjetas del entreno activo empiezan expandidas al cargar', () => {
    render(<HoyWrapper initialDB={activeWorkoutDB} />)
    const body0 = document.getElementById('body-0')
    expect(body0).toHaveClass('open')
  })

  it('al iniciar entreno, las tarjetas quedan expandidas', async () => {
    render(<HoyWrapper />)
    await userEvent.click(screen.getByRole('button', { name: /iniciar entreno/i }))
    await waitFor(() => {
      const body0 = document.getElementById('body-0')
      expect(body0).toHaveClass('open')
    })
  })

  it('el entreno completado no auto-expande tarjetas', () => {
    const completedDB: DB = {
      ...testDB,
      history: [
        ...testDB.history,
        {
          date: '2026-03-23',
          type: 'LUNES',
          completed: true,
          logs: [
            { exercise_id: 'press_banca', name: 'Press de Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 80 },
          ],
        },
      ],
    }
    render(<HoyWrapper initialDB={completedDB} />)
    const body0 = document.getElementById('body-0')
    expect(body0).not.toHaveClass('open')
  })
})

// ── Entrenamiento completado: reps reales y read-only ────────────────

describe('HoyView — entrenamiento completado', () => {
  const completedDB: DB = {
    ...testDB,
    history: [
      ...testDB.history,
      {
        date: '2026-03-23',
        type: 'LUNES',
        completed: true,
        logs: [
          { exercise_id: 'press_banca', name: 'Press de Banca', series: 4, reps: { expected: 8, actual: [8, 8, 7, 6] }, weight: 80 },
        ],
      },
    ],
  }

  it('muestra reps reales desglosadas en el subtitle del card', () => {
    render(<HoyWrapper initialDB={completedDB} />)
    const subtitle = document.querySelector('.card-subtitle')!
    expect(subtitle.textContent).toMatch(/real.*8.*8.*7.*6/)
  })

  it('es read-only — no hay botones btn-icon dentro del body', () => {
    render(<HoyWrapper initialDB={completedDB} />)
    // Expand to see body content
    const body = document.getElementById('body-0')!
    const buttons = body.querySelectorAll('button.btn-icon')
    expect(buttons).toHaveLength(0)
  })
})

// ── Auto-propagación de reps objetivo ────────────────────────────────

describe('HoyView — auto-propagación reps obj', () => {
  it('al pulsar + en reps obj, todas las reps reales se actualizan al nuevo valor', async () => {
    render(<HoyWrapper initialDB={activeWorkoutDB} />)
    // body-0 should be open (active workout auto-expands)
    const body0 = document.getElementById('body-0')!
    // Find the Reps obj. param-row (third one), click +
    const paramRows = body0.querySelectorAll('.param-row')
    const repsRow = paramRows[2] // Peso, Series, Reps obj.
    const plusBtn = repsRow.querySelectorAll('button.btn-icon')[1]
    await userEvent.click(plusBtn)
    // Expected was 10, now 11. All actual reps should be 11
    const seriesInputs = body0.querySelectorAll<HTMLInputElement>('.series-row input')
    for (const input of seriesInputs) {
      expect(input.value).toBe('11')
    }
  })
})
