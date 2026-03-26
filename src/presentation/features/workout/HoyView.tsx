import { useState } from 'react'
import type { DB, DayOfWeek, HistoryEntry, ExerciseLog } from '../../../domain/shared/DB'
import { ExerciseLogCard } from '../../components/ExerciseLogCard'

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
        const logs = h.logs.map((log, i) => {
          if (i !== exerciseIdx) return log
          const newExpected = Math.max(1, log.reps.expected + delta)
          return { ...log, reps: { expected: newExpected, actual: new Array(log.series).fill(newExpected) } }
        })
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
              <ExerciseLogCard
                key={`${log.exercise_id}-${i}`}
                log={log}
                cardIdx={i}
                expanded={expandedCards.has(i)}
                editing={true}
                onToggleExpand={() => toggleCard(i)}
                onRepUpdate={(si, reps) => updateSeriesRep(i, si, reps)}
                onWeightChange={(d) => updateWeight(i, d)}
                onSeriesChange={(d) => updateSeries(i, d)}
                onExpectedRepsChange={(d) => updateExpectedReps(i, d)}
                actionSlot={<button className="btn-danger btn-sm" onClick={() => onModalRequest({ type: 'confirm-remove', exerciseIdx: i })}>Quitar de rutina</button>}
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
              <ExerciseLogCard
                key={`${log.exercise_id}-${i}`}
                log={log}
                cardIdx={i}
                expanded={expandedCards.has(i)}
                editing={false}
                onToggleExpand={() => toggleCard(i)}
              />
            ))}
          </div>
        )}

      </div>
    </>
  )
}

