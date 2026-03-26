import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { GraficasView } from '../GraficasView'
import type { DB } from '../../../../domain/shared/DB'

// Chart.js y el adaptador no funcionan en jsdom — mock completo
vi.mock('chart.js', () => ({
  Chart: class FakeChart {
    static register() {}
    destroy() {}
  },
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  LineController: {},
  BarElement: {},
  BarController: {},
  TimeScale: {},
  Tooltip: {},
  Legend: {},
}))
vi.mock('chartjs-adapter-date-fns', () => ({}))

const emptyDB: DB = {
  auth: { username: 'test', passwordHash: 'hash' },
  exercises: {},
  routines: { LUNES: [], MIERCOLES: [], VIERNES: [] },
  history: [],
}

const dbWithHistory: DB = {
  auth: { username: 'test', passwordHash: 'hash' },
  exercises: {
    press_banca: { id: 'press_banca', name: 'Press de Banca' },
    curl_biceps: { id: 'curl_biceps', name: 'Curl de Bíceps' },
  },
  routines: { LUNES: ['press_banca', 'curl_biceps'], MIERCOLES: [], VIERNES: [] },
  history: [
    {
      date: '2026-03-23',
      type: 'LUNES',
      completed: true,
      logs: [
        { exercise_id: 'press_banca', name: 'Press de Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 80 },
        { exercise_id: 'curl_biceps', name: 'Curl de Bíceps', series: 3, reps: { expected: 10, actual: [10, 9, 8] }, weight: 20 },
      ],
    },
  ],
}

beforeEach(() => {
  // Chart.js llama register() como efecto de importar el módulo
  vi.clearAllMocks()
})

// ── Bug 3a: Placeholder cuando no hay ejercicio seleccionado ─────────

describe('GraficasView — placeholder sin ejercicio (Bug 3)', () => {
  it('muestra placeholder cuando no hay historial', () => {
    render(<GraficasView db={emptyDB} />)
    // Debería aparecer al menos un placeholder
    const placeholders = screen.getAllByText(/selecciona un ejercicio/i)
    expect(placeholders.length).toBeGreaterThan(0)
  })

  it('no muestra canvas cuando no hay ejercicio seleccionado (sin historial)', () => {
    render(<GraficasView db={emptyDB} />)
    expect(document.getElementById('chart-canvas')).not.toBeInTheDocument()
    expect(document.getElementById('chart-canvas-weight')).not.toBeInTheDocument()
  })
})

// ── Bug 3b: Auto-selección del primer ejercicio ──────────────────────

describe('GraficasView — auto-selección (Bug 3)', () => {
  it('el selector tiene el primer ejercicio seleccionado cuando hay historial', async () => {
    render(<GraficasView db={dbWithHistory} />)
    await waitFor(() => {
      const select = document.getElementById('chart-exercise-select') as HTMLSelectElement
      expect(select.value).not.toBe('')
    })
  })

  it('aparece el canvas cuando el ejercicio es auto-seleccionado', async () => {
    render(<GraficasView db={dbWithHistory} />)
    await waitFor(() => {
      expect(document.getElementById('chart-canvas')).toBeInTheDocument()
      expect(document.getElementById('chart-canvas-weight')).toBeInTheDocument()
    })
  })
})
