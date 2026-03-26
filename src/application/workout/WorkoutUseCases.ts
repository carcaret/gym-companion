import type { DayOfWeek, HistoryEntry } from '../../domain/shared/DB'
import type { LocalStorageRepository } from '../../infrastructure/persistence/LocalStorageRepository'

type Storage = Pick<LocalStorageRepository, 'load' | 'save'>

export class StartWorkoutUseCase {
  constructor(private storage: Storage) {}

  execute(dayType: DayOfWeek, date: string): HistoryEntry {
    const db = this.storage.load()!
    const exerciseIds = db.routines[dayType] ?? []

    const logs = exerciseIds.map((id) => {
      const last = this.getLastValues(id, dayType, db.history)
      return {
        exercise_id: id,
        name: db.exercises[id]?.name ?? id,
        series: last.series,
        reps: { expected: last.repsExpected, actual: new Array(last.series).fill(null) as null[] },
        weight: last.weight,
      }
    })

    const entry: HistoryEntry = { date, type: dayType, completed: false, logs }
    const history = [...db.history.filter((h) => h.date !== date), entry]
    this.storage.save({ ...db, history })
    return entry
  }

  private getLastValues(exerciseId: string, dayType: DayOfWeek, history: HistoryEntry[]) {
    const entries = history.filter((h) => h.type === dayType)
    for (let i = entries.length - 1; i >= 0; i--) {
      const log = entries[i].logs.find((l) => l.exercise_id === exerciseId)
      if (log) return { series: log.series, repsExpected: log.reps.expected, weight: log.weight }
    }
    return { series: 3, repsExpected: 10, weight: 0 }
  }
}

export class RecordSeriesUseCase {
  constructor(private storage: Storage) {}

  execute(date: string, exerciseId: string, seriesIndex: number, reps: number) {
    const db = this.storage.load()!
    const history = db.history.map((entry) => {
      if (entry.date !== date) return entry
      return {
        ...entry,
        logs: entry.logs.map((log) => {
          if (log.exercise_id !== exerciseId) return log
          const actual = [...log.reps.actual]
          actual[seriesIndex] = reps
          return { ...log, reps: { ...log.reps, actual } }
        }),
      }
    })
    this.storage.save({ ...db, history })
  }
}

export class CompleteWorkoutUseCase {
  constructor(private storage: Storage) {}

  execute(date: string) {
    const db = this.storage.load()!
    const history = db.history.map((entry) =>
      entry.date === date ? { ...entry, completed: true } : entry
    )
    this.storage.save({ ...db, history })
  }
}
