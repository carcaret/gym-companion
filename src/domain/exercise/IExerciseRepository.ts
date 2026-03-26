import type { Exercise } from '../shared/DB'

export interface IExerciseRepository {
  getAll(): Record<string, Exercise>
  saveExercises(exercises: Record<string, Exercise>): void
}
