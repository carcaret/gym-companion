import { describe, it, expect, vi } from 'vitest'
import { LoginUseCase, LogoutUseCase, ChangePasswordUseCase } from '../AuthUseCases'
import type { ICryptoService } from '../../../domain/auth/ICryptoService'
import type { LocalStorageRepository } from '../../../infrastructure/persistence/LocalStorageRepository'
import type { DB } from '../../../domain/shared/DB'

const stubDB: DB = {
  auth: { username: 'carlos', passwordHash: 'correcthash' },
  exercises: {},
  routines: { LUNES: [], MIERCOLES: [], VIERNES: [] },
  history: [],
}

function makeCrypto(overrides = {}): ICryptoService {
  return {
    hashPassword: vi.fn().mockResolvedValue('correcthash'),
    verifyPassword: vi.fn().mockResolvedValue(true),
    xorEncrypt: vi.fn(),
    xorDecrypt: vi.fn(),
    ...overrides,
  }
}

function makeStorageRepo(): Pick<LocalStorageRepository, 'load' | 'save' | 'setSession' | 'getSession' | 'clearSession'> {
  return {
    load: vi.fn().mockReturnValue(stubDB),
    save: vi.fn(),
    setSession: vi.fn(),
    getSession: vi.fn().mockReturnValue({ token: 'tok', user: 'carlos', hash: 'correcthash' }),
    clearSession: vi.fn(),
  }
}

describe('LoginUseCase', () => {
  it('autentica y devuelve la DB cuando las credenciales son correctas', async () => {
    const storage = makeStorageRepo()
    const crypto = makeCrypto()
    const sut = new LoginUseCase(storage as never, crypto)

    const result = await sut.execute('carlos', 'password')
    expect(result).toEqual(stubDB)
  })

  it('lanza AuthError cuando la contraseña es incorrecta', async () => {
    const storage = makeStorageRepo()
    const crypto = makeCrypto({ hashPassword: vi.fn().mockResolvedValue('wronghash') })
    const sut = new LoginUseCase(storage as never, crypto)

    await expect(sut.execute('carlos', 'wrong')).rejects.toThrow('Credenciales incorrectas')
  })

  it('lanza AuthError cuando el usuario no existe', async () => {
    const storage = { ...makeStorageRepo(), load: vi.fn().mockReturnValue(stubDB) }
    const crypto = makeCrypto()
    const sut = new LoginUseCase(storage as never, crypto)

    await expect(sut.execute('otro', 'password')).rejects.toThrow('Credenciales incorrectas')
  })
})

describe('LogoutUseCase', () => {
  it('limpia la sesión', () => {
    const storage = makeStorageRepo()
    const sut = new LogoutUseCase(storage as never)
    sut.execute()
    expect(storage.clearSession).toHaveBeenCalled()
  })
})

describe('ChangePasswordUseCase', () => {
  it('actualiza el hash y la sesión cuando la contraseña actual es correcta', async () => {
    const storage = makeStorageRepo()
    const crypto = makeCrypto({
      hashPassword: vi.fn()
        .mockResolvedValueOnce('correcthash') // verificación contraseña actual
        .mockResolvedValueOnce('newhash'),    // hash de la nueva contraseña
    })
    const sut = new ChangePasswordUseCase(storage as never, crypto)

    await sut.execute('correctpass', 'newpass')
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({ auth: expect.objectContaining({ passwordHash: 'newhash' }) })
    )
    expect(storage.setSession).toHaveBeenCalledWith(
      expect.objectContaining({ hash: 'newhash' })
    )
  })

  it('lanza error cuando la contraseña actual es incorrecta', async () => {
    const storage = makeStorageRepo()
    const crypto = makeCrypto({
      hashPassword: vi.fn().mockResolvedValue('differenthash'),
    })
    const sut = new ChangePasswordUseCase(storage as never, crypto)

    await expect(sut.execute('wrongpass', 'newpass')).rejects.toThrow('Contraseña incorrecta')
  })
})
