import type { DayOfWeek, HistoryEntry } from '../../../domain/shared/DB'
import { WorkoutCard } from './components/WorkoutCard'

const DAY_LABELS: Record<DayOfWeek, string> = { LUNES: 'Lunes', MIERCOLES: 'Miércoles', VIERNES: 'Viernes' }

interface Props {
  entry: HistoryEntry | null
  dayType: DayOfWeek | null
  onStart: () => void
  onSeriesUpdate: (exerciseId: string, seriesIndex: number, reps: number) => void
  onComplete: () => void
}

export function WorkoutView({ entry, dayType, onStart, onSeriesUpdate, onComplete }: Props) {
  if (!entry) {
    return (
      <div className="workout-view">
        <h2>Hoy — {dayType ? DAY_LABELS[dayType] : 'Sin rutina'}</h2>
        {dayType && <button onClick={onStart}>Iniciar entreno</button>}
      </div>
    )
  }

  if (entry.completed) {
    return (
      <div className="workout-view">
        <h2>✓ Entreno completado</h2>
        <p>Buen trabajo, {DAY_LABELS[entry.type]} completado.</p>
      </div>
    )
  }

  return (
    <div className="workout-view">
      <h2>Entreno activo — {DAY_LABELS[entry.type]}</h2>
      {entry.logs.map((log) => (
        <WorkoutCard key={log.exercise_id} log={log} isPR={false} onSeriesUpdate={onSeriesUpdate} />
      ))}
      <button onClick={onComplete}>Finalizar entreno</button>
    </div>
  )
}
