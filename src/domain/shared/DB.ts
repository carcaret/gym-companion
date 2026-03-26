export type DayOfWeek = 'LUNES' | 'MIERCOLES' | 'VIERNES'

export interface Exercise {
  id: string
  name: string
}

export interface ExerciseLog {
  exercise_id: string
  name: string
  series: number
  reps: {
    expected: number
    actual: (number | null)[]
  }
  weight: number
}

export interface HistoryEntry {
  date: string
  type: DayOfWeek
  completed: boolean
  logs: ExerciseLog[]
}

export interface Auth {
  username: string
  passwordHash: string
}

export interface DB {
  auth: Auth
  exercises: Record<string, Exercise>
  routines: Record<DayOfWeek, string[]>
  history: HistoryEntry[]
}
