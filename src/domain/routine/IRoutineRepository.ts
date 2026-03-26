import type { DayOfWeek } from '../shared/DB'

export interface IRoutineRepository {
  getRoutines(): Record<DayOfWeek, string[]>
  saveRoutines(routines: Record<DayOfWeek, string[]>): void
}
