import type { ExerciseLog } from '../shared/DB'

export function computeAvgReps(log: ExerciseLog): number {
  const actual = log.reps.actual.filter((r): r is number => r !== null)
  if (actual.length > 0) return actual.reduce((a, b) => a + b, 0) / actual.length
  return log.reps.expected
}

export function computeVolume(log: ExerciseLog): number {
  const avg = computeAvgReps(log)
  if (log.weight > 0) return log.weight * log.series * avg
  return log.series * avg
}

export function computeE1RM(log: ExerciseLog): number {
  if (log.weight <= 0) return 0
  const avg = computeAvgReps(log)
  return log.weight * (1 + avg / 30)
}
