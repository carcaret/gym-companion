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

  const todayEntry = db.history.find((h) => h.date === todayStr) ?? null

  // Auto-expand all cards when there is an active (not completed) workout
  const [expandedCards, setExpandedCards] = useState<Set<number>>(() =>
    todayEntry && !todayEntry.completed
      ? new Set(todayEntry.logs.map((_, i) => i))
      : new Set()
  )

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

  // ── LAST KNOWN VALUES ────────────────────────────────
  function getLastValues(exerciseId: string, day: DayOfWeek) {
    const entries = db.history.filter((h) => h.type === day)
    for (let i = entries.length - 1; i >= 0; i--) {
      const log = entries[i].logs.find((l) => l.exercise_id === exerciseId)
      if (log) return { series: log.series, repsExpected: log.reps.expected, weight: log.weight }
    }
    return { series: 3, repsExpected: 10, weight: 0 }
  }

  // ── WORKOUT MODE ────────────────────────────────────
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
    setExpandedCards(new Set(logs.map((_, i) => i)))
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

        {/* ── ACTIVE WORKOUT ── */}
        {todayEntry && !todayEntry.completed && (
          <div id="active-workout">
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
            <div className="workout-actions">
              <button id="add-exercise-mid-btn" className="btn-secondary" onClick={() => onModalRequest({ type: 'add-exercise' })}>
                + Ejercicio
              </button>
              <button id="finish-workout-btn" className="btn-primary" onClick={finishWorkout}>
                Finalizar entreno
              </button>
            </div>
          </div>
        )}

        {/* ── COMPLETED WORKOUT ── */}
        {todayEntry?.completed && (
          <div id="completed-workout">
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
    </>
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
    <div id={`exercise-card-${i}`} className="card">
      <div className="card-header" onClick={onToggle}>
        <div className="card-title">{log.name}</div>
        <span className="card-subtitle">{log.series} × {log.reps.expected} @ {log.weight}kg</span>
        <span className={`card-chevron${expanded ? ' open' : ''}`}>▾</span>
      </div>
      <div id={`body-${i}`} className={`card-body${expanded ? ' open' : ''}`}>
        {/* Series rows */}
        {Array.from({ length: log.series }).map((_, si) => (
          <div key={si} className="series-row">
            <span className="series-label">{si + 1}</span>
            <button className="btn-icon" onClick={() => onRepUpdate(si, Math.max(0, (log.reps.actual[si] ?? log.reps.expected) - 1))}>−</button>
            <input
              id={`w-rep-${i}-${si}`}
              className="series-input"
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
          <label>Peso</label>
          <button className="btn-icon" onClick={() => onWeightChange(-2.5)}>−</button>
          <input id={`w-weight-${i}`} className="param-input" type="number" min={0} step={2.5} value={log.weight} readOnly />
          <button className="btn-icon" onClick={() => onWeightChange(2.5)}>+</button>
        </div>
        <div className="param-row">
          <label>Series</label>
          <button className="btn-icon" onClick={() => onSeriesChange(-1)}>−</button>
          <input id={`w-series-${i}`} className="param-input" type="number" min={1} value={log.series} readOnly />
          <button className="btn-icon" onClick={() => onSeriesChange(1)}>+</button>
        </div>
        <div className="param-row">
          <label>Reps obj.</label>
          <button className="btn-icon" onClick={() => onRepsChange(-1)}>−</button>
          <input id={`w-reps-${i}`} className="param-input" type="number" min={1} value={log.reps.expected} readOnly />
          <button className="btn-icon" onClick={() => onRepsChange(1)}>+</button>
        </div>
        <button className="btn-danger btn-sm" onClick={onRemove}>Quitar de rutina</button>
      </div>
    </div>
  )
}
