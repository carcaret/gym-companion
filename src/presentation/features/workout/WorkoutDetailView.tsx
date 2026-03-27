import { useState } from 'react'
import type { DB, HistoryEntry } from '../../../domain/shared/DB'
import { ExerciseLogCard } from '../../components/ExerciseLogCard'

type ModalState =
  | { type: 'add-exercise' }
  | { type: 'confirm-remove'; exerciseIdx: number }

interface Props {
  db: DB
  entry: HistoryEntry
  onUpdateDB: (updater: (db: DB) => DB) => void
  canAddRemoveExercises: boolean
  canFinishWorkout: boolean
  onModalRequest?: (state: ModalState | null) => void
  onBack?: () => void
}

export function WorkoutDetailView({
  entry,
  onUpdateDB,
  canAddRemoveExercises,
  canFinishWorkout,
  onModalRequest,
  onBack,
}: Props) {
  const isActive = !entry.completed

  const [expandedCards, setExpandedCards] = useState<Set<number>>(() =>
    isActive ? new Set(entry.logs.map((_, i) => i)) : new Set()
  )

  const [editing, setEditing] = useState(isActive)

  function toggleCard(i: number) {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function toggleEdit() {
    setEditing((prev) => !prev)
  }

  // ── Update helpers (operate on entry.date) ────────────────────────

  function updateWeight(exerciseIdx: number, delta: number) {
    onUpdateDB((d) => ({
      ...d,
      history: d.history.map((h) => {
        if (h.date !== entry.date) return h
        const logs = h.logs.map((log, i) =>
          i !== exerciseIdx ? log : { ...log, weight: Math.max(0, log.weight + delta) }
        )
        return { ...h, logs }
      }),
    }))
  }

  function updateSeries(exerciseIdx: number, delta: number) {
    onUpdateDB((d) => ({
      ...d,
      history: d.history.map((h) => {
        if (h.date !== entry.date) return h
        const logs = h.logs.map((log, i) => {
          if (i !== exerciseIdx) return log
          const newSeries = Math.max(1, log.series + delta)
          const actual = [...log.reps.actual]
          while (actual.length < newSeries) actual.push(null)
          while (actual.length > newSeries) actual.pop()
          return { ...log, series: newSeries, reps: { ...log.reps, actual } }
        })
        return { ...h, logs }
      }),
    }))
  }

  function updateExpectedReps(exerciseIdx: number, delta: number) {
    onUpdateDB((d) => ({
      ...d,
      history: d.history.map((h) => {
        if (h.date !== entry.date) return h
        const logs = h.logs.map((log, i) => {
          if (i !== exerciseIdx) return log
          const newExpected = Math.max(1, log.reps.expected + delta)
          return { ...log, reps: { expected: newExpected, actual: new Array(log.series).fill(newExpected) } }
        })
        return { ...h, logs }
      }),
    }))
  }

  function updateSeriesRep(exerciseIdx: number, seriesIdx: number, reps: number) {
    onUpdateDB((d) => ({
      ...d,
      history: d.history.map((h) => {
        if (h.date !== entry.date) return h
        const logs = h.logs.map((log, i) => {
          if (i !== exerciseIdx) return log
          const actual = [...log.reps.actual]
          actual[seriesIdx] = reps
          return { ...log, reps: { ...log.reps, actual } }
        })
        return { ...h, logs }
      }),
    }))
  }

  function finishWorkout() {
    onUpdateDB((d) => ({
      ...d,
      history: d.history.map((h) => (h.date === entry.date ? { ...h, completed: true } : h)),
    }))
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="workout-detail">
      {/* Header with back button and edit toggle */}
      <div className="workout-detail-header">
        {onBack && (
          <button className="btn-secondary btn-sm" onClick={onBack}>
            ← Volver
          </button>
        )}
        {entry.completed && (
          <button
            className="btn-icon"
            onClick={toggleEdit}
            title="Editar"
          >
            {editing ? '✅' : '✏️'}
          </button>
        )}
      </div>

      {/* Exercise cards */}
      {entry.logs.map((log, i) => (
        <ExerciseLogCard
          key={`${log.exercise_id}-${i}`}
          log={log}
          cardIdx={i}
          expanded={expandedCards.has(i)}
          editing={editing}
          onToggleExpand={() => toggleCard(i)}
          onRepUpdate={editing ? (si, reps) => updateSeriesRep(i, si, reps) : undefined}
          onWeightChange={editing ? (d) => updateWeight(i, d) : undefined}
          onSeriesChange={editing ? (d) => updateSeries(i, d) : undefined}
          onExpectedRepsChange={editing ? (d) => updateExpectedReps(i, d) : undefined}
          actionSlot={
            canAddRemoveExercises && editing ? (
              <button
                className="btn-danger btn-sm"
                onClick={() => onModalRequest?.({ type: 'confirm-remove', exerciseIdx: i })}
              >
                Quitar de rutina
              </button>
            ) : undefined
          }
        />
      ))}

      {/* Bottom actions */}
      <div className="workout-actions">
        {canAddRemoveExercises && (
          <button
            className="btn-secondary"
            onClick={() => onModalRequest?.({ type: 'add-exercise' })}
          >
            + Ejercicio
          </button>
        )}
        {canFinishWorkout && (
          <button className="btn-primary" onClick={finishWorkout}>
            Finalizar entreno
          </button>
        )}
      </div>
    </div>
  )
}
