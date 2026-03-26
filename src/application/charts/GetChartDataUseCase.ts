import type { LocalStorageRepository } from '../../infrastructure/persistence/LocalStorageRepository'
import { computeVolume, computeE1RM } from '../../domain/workout/WorkoutMetrics'

type Storage = Pick<LocalStorageRepository, 'load'>

export interface ChartPoint {
  x: string
  y: number
}

export interface ChartData {
  volume: ChartPoint[]
  e1rm: ChartPoint[]
  weight: ChartPoint[]
}

export class GetChartDataUseCase {
  constructor(private storage: Storage) {}

  execute(exerciseId: string, from: string | null, to: string | null): ChartData {
    const db = this.storage.load()
    const volume: ChartPoint[] = []
    const e1rm: ChartPoint[] = []
    const weight: ChartPoint[] = []

    for (const entry of db?.history ?? []) {
      if (from && entry.date < from) continue
      if (to && entry.date > to) continue
      for (const log of entry.logs) {
        if (log.exercise_id !== exerciseId) continue
        const vol = computeVolume(log)
        const e1rmVal = computeE1RM(log)
        if (vol > 0) volume.push({ x: entry.date, y: vol })
        if (e1rmVal > 0) e1rm.push({ x: entry.date, y: Math.round(e1rmVal * 10) / 10 })
        if (log.weight > 0) weight.push({ x: entry.date, y: log.weight })
      }
    }

    return { volume, e1rm, weight }
  }
}
