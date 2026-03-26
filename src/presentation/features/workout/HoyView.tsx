import { useState } from 'react'
import type { DB, DayOfWeek, HistoryEntry, ExerciseLog } from '../../../domain/shared/DB'

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
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set())

  const todayEntry = db.history.find((h) => h.date === todayStr) ?? null

  const effectiveDay = selectorOpen ? null : (selectedDay ?? dayType)

  function toggleCard(i: number) {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  // ── REST DAY / DAY SELECTOR ──────────────────────
  const isRestDay = !dayType
  const showSelector = selectorOpen || (isRestDay && !selectedDay)

  // ── TITLE ──────────────────────────────────────────
  function getTitle() {
    if (todayEntry?.completed) return `✓ ${effectiveDay ? DAY_LABELS[effectiveDay] : 'Hoy'}`
    if (effectiveDay) return DAY_LABELS[effectiveDay]
    return 'Hoy'
  }

  // ── WORKOUT MODE ────────────────────────────────────
  function startWorkout() {
    if (!effectiveDay) return
    const exercises = db.routines[effectiveDay] ?? []
    const getLastValues = (id: string) => {
      const entries = db.history.filter((h) => h.type === effectiveDay)
      for (let i = entries.length - 1; i >= 0; i--) {
        const log = entries[i].logs.find((l) => l.exercise_id === id)
        if (log) return { series: log.series, repsExpected: log.reps.expected, weight: log.weight }
      }
      return { series: 3, repsExpected: 10, weight: 0 }
    }
    const logs: ExerciseLog[] = exercises.map((id) => {
      const last = getLastValues(id)
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
    setExpandedCards(new Set())
  }

  function finishWorkout() {
    onUpdateDB((d) => ({
      ...d,
      history: d.history.map((h) => (h.date === todayStr ? { ...h, completed: true } : h)),
    }))
  }

  function updateSeriesRep(exerciseIdx: number, seriesIdx: number, reps: number) {
    onUpdateDB((d) => ({
      ...d,
      history: d.history.map((h) => {
        if (h.date !== todayStr) return h
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

  function updateWeight(exerciseIdx: number, delta: number) {
    onUpdateDB((d) => ({
      ...d,
      history: d.history.map((h) => {
        if (h.date !== todayStr) return h
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
        if (h.date !== todayStr) return h
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
        if (h.date !== todayStr) return h
        const logs = h.logs.map((log, i) =>
          i !== exerciseIdx ? log : { ...log, reps: { ...log.reps, expected: Math.max(1, log.reps.expected + delta) } }
        )
        return { ...h, logs }
      }),
    }))
  }

  // ── PREVIEW EXERCISES (from routine) ────────────────
  const previewExercises = effectiveDay ? (db.routines[effectiveDay] ?? []).map((id) => db.exercises[id]?.name ?? id) : []

  // ── RENDER ──────────────────────────────────────────
  return (
    <div id="hoy-content">
      <div id="hoy-title" className="view-title">{getTitle()}</div>

      {/* ── STATUS ── */}
      {todayEntry && (
        <div className="workout-status">
          {todayEntry.completed ? '✓ Entreno completado' : '💪 Entreno en curso'}
        </div>
      )}

      {/* ── DAY SELECTOR (rest days, no selection) ── */}
      {showSelector && (
        <div className="day-selector">
          <p>Hoy es día de descanso. ¿Quieres hacer una rutina?</p>
          {WORKOUT_DAYS.map((d) => (
            <button key={d} data-day={d} onClick={() => { setSelectedDay(d); setSelectorOpen(false) }}>
              {DAY_LABELS[d]}
            </button>
          ))}
        </div>
      )}

      {/* ── PREVIEW (routine day or day selected, no active workout) ── */}
      {effectiveDay && !todayEntry && (
        <div className="workout-preview">
          <button id="back-to-selector-btn" onClick={() => { setSelectedDay(null); setSelectorOpen(true) }}>
            ← Cambiar día
          </button>
          <ul>
            {previewExercises.map((name, i) => (
              <li key={i}>{name}</li>
            ))}
          </ul>
          <button id="add-exercise-btn" onClick={() => onModalRequest({ type: 'add-exercise' })}>
            + Añadir ejercicio
          </button>
          <button id="start-workout-btn" onClick={startWorkout}>
            Iniciar entreno
          </button>
        </div>
      )}

      {/* ── ACTIVE WORKOUT ── */}
      {todayEntry && !todayEntry.completed && (
        <div className="active-workout">
          <button id="add-exercise-mid-btn" onClick={() => onModalRequest({ type: 'add-exercise' })}>
            + Ejercicio
          </button>
          {todayEntry.logs.map((log, i) => (
            <ExerciseCard
              key={`${log.exercise_id}-${i}`}
              log={log}
              cardIdx={i}
              expanded={expandedCards.has(i)}
              onToggle={() => toggleCard(i)}
              onRepUpdate={(si, reps) => updateSeriesRep(i, si, reps)}
              onWeightChange={(d) => updateWeight(i, d)}
              onSeriesChange={(d) => updateSeries(i, d)}
              onRepsChange={(d) => updateExpectedReps(i, d)}
              onRemove={() => onModalRequest({ type: 'confirm-remove', exerciseIdx: i })}
            />
          ))}
          <button id="finish-workout-btn" onClick={finishWorkout}>
            Finalizar entreno
          </button>
        </div>
      )}

      {/* ── COMPLETED WORKOUT ── */}
      {todayEntry?.completed && (
        <div className="completed-workout">
          {todayEntry.logs.map((log, i) => (
            <ExerciseCard
              key={`${log.exercise_id}-${i}`}
              log={log}
              cardIdx={i}
              expanded={expandedCards.has(i)}
              onToggle={() => toggleCard(i)}
              onRepUpdate={() => {}}
              onWeightChange={() => {}}
              onSeriesChange={() => {}}
              onRepsChange={() => {}}
              onRemove={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Exercise Card ──────────────────────────────────────
interface CardProps {
  log: ExerciseLog
  cardIdx: number
  expanded: boolean
  onToggle: () => void
  onRepUpdate: (seriesIdx: number, reps: number) => void
  onWeightChange: (delta: number) => void
  onSeriesChange: (delta: number) => void
  onRepsChange: (delta: number) => void
  onRemove: () => void
}

function ExerciseCard({ log, cardIdx, expanded, onToggle, onRepUpdate, onWeightChange, onSeriesChange, onRepsChange, onRemove }: CardProps) {
  const i = cardIdx
  return (
    <div id={`exercise-card-${i}`} className="exercise-card">
      <div className="card-header" onClick={onToggle}>
        <span>{log.name}</span>
        <span className="card-subtitle">{log.series} × {log.reps.expected} @ {log.weight}kg</span>
      </div>
      <div id={`body-${i}`} className={`card-body${expanded ? ' open' : ''}`}>
        {/* Series rows */}
        {Array.from({ length: log.series }).map((_, si) => (
          <div key={si} className="series-row">
            <span>Serie {si + 1}</span>
            <button className="btn-icon" onClick={() => onRepUpdate(si, Math.max(0, (log.reps.actual[si] ?? log.reps.expected) - 1))}>−</button>
            <input
              id={`w-rep-${i}-${si}`}
              type="number"
              min={0}
              value={log.reps.actual[si] ?? log.reps.expected}
              onChange={(e) => onRepUpdate(si, Number(e.target.value))}
            />
            <button className="btn-icon" onClick={() => onRepUpdate(si, (log.reps.actual[si] ?? log.reps.expected) + 1)}>+</button>
          </div>
        ))}
        {/* Param rows */}
        <div className="param-row">
          <span>Peso</span>
          <button className="btn-icon" onClick={() => onWeightChange(-2.5)}>−</button>
          <input id={`w-weight-${i}`} type="number" min={0} step={2.5} value={log.weight} readOnly />
          <button className="btn-icon" onClick={() => onWeightChange(2.5)}>+</button>
        </div>
        <div className="param-row">
          <span>Series</span>
          <button className="btn-icon" onClick={() => onSeriesChange(-1)}>−</button>
          <input id={`w-series-${i}`} type="number" min={1} value={log.series} readOnly />
          <button className="btn-icon" onClick={() => onSeriesChange(1)}>+</button>
        </div>
        <div className="param-row">
          <span>Reps obj.</span>
          <button className="btn-icon" onClick={() => onRepsChange(-1)}>−</button>
          <input id={`w-reps-${i}`} type="number" min={1} value={log.reps.expected} readOnly />
          <button className="btn-icon" onClick={() => onRepsChange(1)}>+</button>
        </div>
        <button className="btn-danger" onClick={onRemove}>Quitar de rutina</button>
      </div>
    </div>
  )
}
