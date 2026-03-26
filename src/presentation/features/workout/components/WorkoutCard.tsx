import type { ExerciseLog } from '../../../../domain/shared/DB'
import { SeriesRow } from './SeriesRow'

interface Props {
  log: ExerciseLog
  isPR: boolean
  onSeriesUpdate: (exerciseId: string, seriesIndex: number, reps: number) => void
}

export function WorkoutCard({ log, isPR, onSeriesUpdate }: Props) {
  return (
    <div className="workout-card">
      <div className="workout-card-header">
        <h3>{log.name}</h3>
        {isPR && <span className="record-badge">🏆 PR</span>}
      </div>
      <p>{log.weight > 0 ? `${log.weight} kg` : 'Peso corporal'}</p>
      {Array.from({ length: log.series }).map((_, i) => (
        <SeriesRow
          key={i}
          index={i}
          expected={log.reps.expected}
          actual={log.reps.actual[i] ?? null}
          onUpdate={(idx, reps) => onSeriesUpdate(log.exercise_id, idx, reps)}
        />
      ))}
    </div>
  )
}
