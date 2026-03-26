import { describe, it, expect, beforeEach } from 'vitest'
import { LocalStorageRepository } from '../LocalStorageRepository'
import type { DB } from '../../../domain/shared/DB'

const repo = new LocalStorageRepository()

const stubDB: DB = {
  auth: { username: 'carlos', passwordHash: 'abc123' },
  exercises: { curl_biceps: { id: 'curl_biceps', name: 'Curl de bíceps' } },
  routines: { LUNES: ['curl_biceps'], MIERCOLES: [], VIERNES: [] },
  history: [],
}

describe('LocalStorageRepository', () => {
  beforeEach(() => localStorage.clear())

  it('save + load devuelve la misma DB', () => {
    repo.save(stubDB)
    expect(repo.load()).toEqual(stubDB)
  })

  it('load devuelve null cuando localStorage está vacío', () => {
    expect(repo.load()).toBeNull()
  })

  it('setSession + getSession persiste la sesión', () => {
    repo.setSession({ token: 'tok', user: 'carlos', hash: 'abc' })
    expect(repo.getSession()).toEqual({ token: 'tok', user: 'carlos', hash: 'abc' })
  })

  it('getSession devuelve null cuando no hay sesión', () => {
    expect(repo.getSession()).toBeNull()
  })

  it('clearSession elimina la sesión', () => {
    repo.setSession({ token: 'tok', user: 'carlos', hash: 'abc' })
    repo.clearSession()
    expect(repo.getSession()).toBeNull()
  })
})
