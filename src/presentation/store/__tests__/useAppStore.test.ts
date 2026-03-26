import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAppStore } from '../useAppStore'

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({ db: null, isAuthenticated: false, activeView: 'hoy' })
  })

  it('estado inicial: no autenticado, vista hoy, sin DB', () => {
    const { result } = renderHook(() => useAppStore())
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.activeView).toBe('hoy')
    expect(result.current.db).toBeNull()
  })

  it('setActiveView cambia la vista activa', () => {
    const { result } = renderHook(() => useAppStore())
    act(() => result.current.setActiveView('historial'))
    expect(result.current.activeView).toBe('historial')
  })

  it('setDB guarda la DB en el estado', () => {
    const { result } = renderHook(() => useAppStore())
    const db = { auth: { username: 'carlos', passwordHash: 'h' }, exercises: {}, routines: { LUNES: [], MIERCOLES: [], VIERNES: [] }, history: [] }
    act(() => result.current.setDB(db))
    expect(result.current.db).toEqual(db)
  })

  it('setAuthenticated actualiza el estado de autenticación', () => {
    const { result } = renderHook(() => useAppStore())
    act(() => result.current.setAuthenticated(true))
    expect(result.current.isAuthenticated).toBe(true)
  })
})
