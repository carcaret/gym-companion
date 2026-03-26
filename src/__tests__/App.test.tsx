import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from '../App'

// Chart.js no funciona en jsdom
vi.mock('chart.js', () => ({
  Chart: class FakeChart {
    static register() {}
    destroy() {}
  },
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  BarElement: {},
  LineController: {},
  BarController: {},
  TimeScale: {},
  Tooltip: {},
  Legend: {},
}))
vi.mock('chartjs-adapter-date-fns', () => ({}))

const DB_KEY = 'gym_companion_db'
const SESSION_KEY = 'gym_companion_session'

const minimalDB = {
  auth: { username: 'carlos', passwordHash: 'fdde8412bc6a358138968e92ea01f5db12d3941db894c57c5384491e54700a07' },
  exercises: {},
  routines: { LUNES: [], MIERCOLES: [], VIERNES: [] },
  history: [],
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('App — inicialización desde db.json', () => {
  it('siembra localStorage con db.json cuando está vacío y muestra el login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => minimalDB }))

    render(<App />)

    expect(await screen.findByLabelText(/usuario/i)).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('./db.json')
    expect(JSON.parse(localStorage.getItem(DB_KEY)!).auth.username).toBe('carlos')
  })

  it('sigue mostrando el login si fetch falla (sin db.json disponible)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('not found')))

    render(<App />)

    expect(await screen.findByLabelText(/usuario/i)).toBeInTheDocument()
  })

  it('sigue mostrando el login si db.json responde con ok:false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    render(<App />)

    expect(await screen.findByLabelText(/usuario/i)).toBeInTheDocument()
  })
})

describe('App — restauración de sesión', () => {
  it('restaura la sesión automáticamente si localStorage tiene datos y sesión válidos', async () => {
    localStorage.setItem(DB_KEY, JSON.stringify(minimalDB))
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      token: 'tok',
      user: 'carlos',
      hash: minimalDB.auth.passwordHash,
    }))

    render(<App />)

    // El nav de tabs sólo es visible cuando #app-shell no tiene hidden (autenticado)
    expect(await screen.findByRole('navigation')).toBeInTheDocument()
  })

  it('muestra el login si la sesión no coincide con el hash de la DB', async () => {
    localStorage.setItem(DB_KEY, JSON.stringify(minimalDB))
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      token: 'tok',
      user: 'carlos',
      hash: 'hashIncorrecto',
    }))

    render(<App />)

    expect(await screen.findByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })
})
