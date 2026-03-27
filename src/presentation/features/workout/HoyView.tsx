import { useState } from 'react'
import type { DB, DayOfWeek, HistoryEntry, ExerciseLog } from '../../../domain/shared/DB'
import { WorkoutDetailView } from './WorkoutDetailView'

const DAY_LABELS: Record<DayOfWeek, string> = { LUNES: 'Lunes', MIERCOLES: 'Miércoles', VIERNES: 'Viernes' }
const WORKOUT_DAYS: DayOfWeek[] = ['LUNES', 'MIERCOLES', 'VIERNES']

type ModalState =
  | { type: 'add-exercise' }
  | { type: 'confirm-remove'; exerciseIdx: number }

interface Props {
  db: DB
  todayStr: string
  dayType: DayOfWeek | null
  onUpdateDB: (updater: (db: DB) => DB) => void
  onModalRequest: (state: ModalState | null) => void
}

export function HoyView({ db, todayStr, dayType, onUpdateDB, onModalRequest }: Props) {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | null>(dayType)
  const [selectorOpen, setSelectorOpen] = useState(false)

  const todayEntry = db.history.find((h) => h.date === todayStr) ?? null

  const effectiveDay = selectorOpen ? null : (selectedDay ?? dayType)

  // ── REST DAY / DAY SELECTOR ──────────────────────
  const isRestDay = !dayType
  const showSelector = selectorOpen || (isRestDay && !selectedDay)

  // ── TITLE ──────────────────────────────────────────
  function getTitle() {
    if (todayEntry?.completed) return `✓ ${effectiveDay ? DAY_LABELS[effectiveDay] : 'Hoy'}`
    if (effectiveDay) return DAY_LABELS[effectiveDay]
    return 'Hoy'
  }

  // ── LAST KNOWN VALUES ────────────────────────────────
  function getLastValues(exerciseId: string, day: DayOfWeek) {
    const entries = db.history.filter((h) => h.type === day)
    for (let i = entries.length - 1; i >= 0; i--) {
      const log = entries[i].logs.find((l) => l.exercise_id === exerciseId)
      if (log) return { series: log.series, repsExpected: log.reps.expected, weight: log.weight }
    }
    return { series: 3, repsExpected: 10, weight: 0 }
  }

  // ── START WORKOUT ────────────────────────────────────
  function startWorkout() {
    if (!effectiveDay) return
    const exercises = db.routines[effectiveDay] ?? []
    const logs: ExerciseLog[] = exercises.map((id) => {
      const last = getLastValues(id, effectiveDay)
      return {
        exercise_id: id,
        name: db.exercises[id]?.name ?? id,
        series: last.series,
        reps: { expected: last.repsExpected, actual: new Array(last.series).fill(null) as null[] },
        weight: last.weight,
      }
    })
    const entry: HistoryEntry = { date: todayStr, type: effectiveDay, completed: false, logs }
    onUpdateDB((d) => ({ ...d, history: [...d.history.filter((h) => h.date !== todayStr), entry] }))
  }

  // ── PREVIEW ITEMS (from routine, with last known values) ─────────────
  const previewItems = effectiveDay
    ? (db.routines[effectiveDay] ?? []).map((id) => ({
        id,
        name: db.exercises[id]?.name ?? id,
        ...getLastValues(id, effectiveDay),
      }))
    : []

  // ── RENDER ──────────────────────────────────────────
  return (
    <>
      <div className="view-header">
        <h2 id="hoy-title">{getTitle()}</h2>
      </div>

      <div className="view-body" id="hoy-content">

        {/* ── STATUS ── */}
        {todayEntry && (
          <div className="workout-status">
            <span className="pulse-dot" />
            {todayEntry.completed ? '✓ Entreno completado' : '💪 Entreno en curso'}
          </div>
        )}

        {/* ── DAY SELECTOR (rest days, no selection) ── */}
        {showSelector && (
          <div className="day-selector">
            <p className="day-selector-title">Hoy es día de descanso. ¿Quieres hacer una rutina?</p>
            {WORKOUT_DAYS.map((d) => (
              <button key={d} data-day={d} className="day-btn" onClick={() => { setSelectedDay(d); setSelectorOpen(false) }}>
                <span className="day-icon">🗓️</span>
                <span className="day-info">
                  <span className="day-name">{DAY_LABELS[d]}</span>
                  <span className="day-exercises">{(db.routines[d] ?? []).length} ejercicios</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ── PREVIEW (routine day or day selected, no active workout) ── */}
        {effectiveDay && !todayEntry && (
          <div id="workout-preview">
            <button id="back-to-selector-btn" className="btn-secondary btn-sm" onClick={() => { setSelectedDay(null); setSelectorOpen(true) }}>
              ← Cambiar día
            </button>
            <div className="preview-list">
              {previewItems.map((item, i) => (
                <div key={i} className="exercise-row">
                  <span className="exercise-name">{item.name}</span>
                  <div className="exercise-meta">
                    <span className="meta-pill">
                      <strong>{item.series}</strong>&nbsp;×&nbsp;<strong>{item.repsExpected}</strong>&nbsp;reps
                    </span>
                    {item.weight > 0 && (
                      <span className="meta-pill">
                        <strong>{item.weight}</strong>&nbsp;kg
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="workout-actions">
              <button id="add-exercise-btn" className="btn-secondary" onClick={() => onModalRequest({ type: 'add-exercise' })}>
                + Añadir ejercicio
              </button>
              <button id="start-workout-btn" className="btn-primary" onClick={startWorkout}>
                Iniciar entreno
              </button>
            </div>
          </div>
        )}

        {/* ── WORKOUT (active or completed) → WorkoutDetailView ── */}
        {todayEntry && (
          <WorkoutDetailView
            db={db}
            entry={todayEntry}
            onUpdateDB={onUpdateDB}
            canAddRemoveExercises={true}
            canFinishWorkout={!todayEntry.completed}
            onModalRequest={onModalRequest}
          />
        )}

      </div>
    </>
  )
}
