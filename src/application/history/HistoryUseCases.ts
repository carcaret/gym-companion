import type { DayOfWeek, HistoryEntry } from '../../domain/shared/DB'
import type { LocalStorageRepository } from '../../infrastructure/persistence/LocalStorageRepository'

type Storage = Pick<LocalStorageRepository, 'load'>

export class GetHistoryUseCase {
  constructor(private storage: Storage) {}

  execute(): HistoryEntry[] {
    const db = this.storage.load()
    return [...(db?.history ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  }
}

export class FilterHistoryUseCase {
  constructor(private storage: Storage) {}

  execute(day: DayOfWeek | null): HistoryEntry[] {
    const db = this.storage.load()
    const history = [...(db?.history ?? [])].sort((a, b) => b.date.localeCompare(a.date))
    if (!day) return history
    return history.filter((e) => e.type === day)
  }
}
