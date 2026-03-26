import type { Exercise } from '../shared/DB'

export interface IExerciseRepository {
  getAll(): Record<string, Exercise>
  save(exercises: Record<string, Exercise>): void
}
