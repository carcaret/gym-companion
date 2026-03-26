import type { ICryptoService } from '../../domain/auth/ICryptoService'
import type { LocalStorageRepository } from '../../infrastructure/persistence/LocalStorageRepository'

type Storage = Pick<LocalStorageRepository, 'load' | 'save' | 'setSession' | 'getSession' | 'clearSession'>

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export class LoginUseCase {
  constructor(private storage: Storage, private crypto: ICryptoService) {}

  async execute(username: string, password: string) {
    const db = this.storage.load()
    if (!db) throw new AuthError('Credenciales incorrectas')
    const hash = await this.crypto.hashPassword(password)
    if (db.auth.username.toLowerCase() !== username.toLowerCase() || db.auth.passwordHash !== hash) {
      throw new AuthError('Credenciales incorrectas')
    }
    const token = crypto.randomUUID()
    this.storage.setSession({ token, user: db.auth.username, hash })
    return db
  }
}

export class LogoutUseCase {
  constructor(private storage: Pick<Storage, 'clearSession'>) {}

  execute() {
    this.storage.clearSession()
  }
}

export class ChangePasswordUseCase {
  constructor(private storage: Storage, private crypto: ICryptoService) {}

  async execute(currentPassword: string, newPassword: string) {
    const db = this.storage.load()
    if (!db) throw new AuthError('Sin datos')
    const currentHash = await this.crypto.hashPassword(currentPassword)
    if (currentHash !== db.auth.passwordHash) throw new AuthError('Contraseña incorrecta')
    const newHash = await this.crypto.hashPassword(newPassword)
    const updatedDB = { ...db, auth: { ...db.auth, passwordHash: newHash } }
    this.storage.save(updatedDB)
    const session = this.storage.getSession()
    if (session) this.storage.setSession({ ...session, hash: newHash })
  }
}
