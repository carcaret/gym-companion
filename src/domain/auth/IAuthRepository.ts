import type { Auth } from '../shared/DB'

export interface IAuthRepository {
  getAuth(): Auth | null
  saveAuth(auth: Auth): void
}
