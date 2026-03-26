import type { ExerciseLog, HistoryEntry } from '../shared/DB'
import { computeVolume, computeE1RM } from './WorkoutMetrics'

export function detectPR(current: ExerciseLog, history: HistoryEntry[]): boolean {
  const hasActualReps = current.reps.actual.some((r) => r !== null)
  if (!hasActualReps) return false

  const currentVol = computeVolume(current)
  const currentE1RM = computeE1RM(current)

  let prevMaxVol = 0
  let prevMaxE1RM = 0

  for (const entry of history) {
    for (const log of entry.logs) {
      if (log.exercise_id === current.exercise_id) {
        prevMaxVol = Math.max(prevMaxVol, computeVolume(log))
        prevMaxE1RM = Math.max(prevMaxE1RM, computeE1RM(log))
      }
    }
  }

  return (currentVol > 0 && currentVol > prevMaxVol) || (currentE1RM > 0 && currentE1RM > prevMaxE1RM)
}
