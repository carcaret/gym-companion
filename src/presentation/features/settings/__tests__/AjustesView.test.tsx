import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { AjustesView } from '../AjustesView'
import type { DB } from '../../../../domain/shared/DB'

const testDB: DB = {
  auth: { username: 'test', passwordHash: 'hash' },
  exercises: {},
  routines: { LUNES: [], MIERCOLES: [], VIERNES: [] },
  history: [],
}

// ── Bug 5: Inputs de texto con type="text" explícito ─────────────────

describe('AjustesView — atributos de inputs (Bug 5)', () => {
  it('el input de repositorio tiene type="text"', () => {
    render(<AjustesView db={testDB} onChangePassword={vi.fn()} onLogout={vi.fn()} />)
    const input = document.getElementById('set-repo') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.type).toBe('text')
  })

  it('el input de rama tiene type="text"', () => {
    render(<AjustesView db={testDB} onChangePassword={vi.fn()} onLogout={vi.fn()} />)
    const input = document.getElementById('set-branch') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.type).toBe('text')
  })

  it('el input de ruta tiene type="text"', () => {
    render(<AjustesView db={testDB} onChangePassword={vi.fn()} onLogout={vi.fn()} />)
    const input = document.getElementById('set-path') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.type).toBe('text')
  })

  it('los inputs de contraseña mantienen type="password"', () => {
    render(<AjustesView db={testDB} onChangePassword={vi.fn()} onLogout={vi.fn()} />)
    const oldPass = document.getElementById('set-old-pass') as HTMLInputElement
    const newPass = document.getElementById('set-new-pass') as HTMLInputElement
    expect(oldPass.type).toBe('password')
    expect(newPass.type).toBe('password')
  })
})
