import type { DB } from '../../domain/shared/DB'
import type { IWorkoutRepository } from '../../domain/workout/IWorkoutRepository'
import type { IAuthRepository } from '../../domain/auth/IAuthRepository'
import type { IExerciseRepository } from '../../domain/exercise/IExerciseRepository'
import type { IRoutineRepository } from '../../domain/routine/IRoutineRepository'
import type { HistoryEntry, Auth, Exercise } from '../../domain/shared/DB'
import type { DayOfWeek } from '../../domain/shared/DB'

const DB_LOCAL_KEY = 'gym_companion_db'
const SESSION_KEY = 'gym_companion_session'

export interface Session {
  token: string
  user: string
  hash: string
}

export class LocalStorageRepository
  implements IWorkoutRepository, IAuthRepository, IExerciseRepository, IRoutineRepository
{
  save(db: DB): void {
    localStorage.setItem(DB_LOCAL_KEY, JSON.stringify(db))
  }

  load(): DB | null {
    try {
      const raw = localStorage.getItem(DB_LOCAL_KEY)
      return raw ? (JSON.parse(raw) as DB) : null
    } catch {
      return null
    }
  }

  getSession(): Session | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      return raw ? (JSON.parse(raw) as Session) : null
    } catch {
      return null
    }
  }

  setSession(session: Session): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  }

  clearSession(): void {
    localStorage.removeItem(SESSION_KEY)
  }

  // IWorkoutRepository
  getHistory(): HistoryEntry[] {
    return this.load()?.history ?? []
  }
  saveHistory(history: HistoryEntry[]): void {
    const db = this.load()
    if (db) this.save({ ...db, history })
  }

  // IAuthRepository
  getAuth(): Auth | null {
    return this.load()?.auth ?? null
  }
  saveAuth(auth: Auth): void {
    const db = this.load()
    if (db) this.save({ ...db, auth })
  }

  // IExerciseRepository
  getAll(): Record<string, Exercise> {
    return this.load()?.exercises ?? {}
  }
  saveExercises(exercises: Record<string, Exercise>): void {
    const db = this.load()
    if (db) this.save({ ...db, exercises })
  }

  // IRoutineRepository
  getRoutines(): Record<DayOfWeek, string[]> {
    return this.load()?.routines ?? { LUNES: [], MIERCOLES: [], VIERNES: [] }
  }
  saveRoutines(routines: Record<DayOfWeek, string[]>): void {
    const db = this.load()
    if (db) this.save({ ...db, routines })
  }
}
