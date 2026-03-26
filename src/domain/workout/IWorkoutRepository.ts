import type { HistoryEntry } from '../shared/DB'

export interface IWorkoutRepository {
  getHistory(): HistoryEntry[]
  saveHistory(history: HistoryEntry[]): void
}
