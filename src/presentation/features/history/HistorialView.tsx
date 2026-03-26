import { useState } from 'react'
import type { DB, DayOfWeek } from '../../../domain/shared/DB'
import { ExerciseLogCard } from '../../components/ExerciseLogCard'

const DAY_LABELS: Record<DayOfWeek, string> = { LUNES: 'Lunes', MIERCOLES: 'Miércoles', VIERNES: 'Viernes' }
type Filter = DayOfWeek | 'TODOS'

interface Props {
  db: DB
  onUpdateDB: (updater: (db: DB) => DB) => void
  onModalRequest: (state: HistModalState | null) => void
}

export type HistModalState =
  | { type: 'confirm-delete'; entryDate: string }

export function HistorialView({ db, onUpdateDB, onModalRequest }: Props) {
  const [activeFilter, setActiveFilter] = useState<Filter>('TODOS')
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set())
  const [editingEntries, setEditingEntries] = useState<Set<number>>(new Set())

  const sorted = [...db.history].sort((a, b) => b.date.localeCompare(a.date))
  const displayed = activeFilter === 'TODOS' ? sorted : sorted.filter((e) => e.type === activeFilter)

  function toggleExpand(i: number) {
    setExpandedEntries((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function toggleEdit(i: number) {
    setEditingEntries((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else { next.add(i); setExpandedEntries((e) => new Set([...e, i])) }
      return next
    })
  }

  function updateWeight(entryDate: string, exerciseIdx: number, delta: number) {
    onUpdateDB((d) => ({
      ...d,
      history: d.history.map((h) => {
        if (h.date !== entryDate) return h
        const logs = h.logs.map((log, i) =>
          i !== exerciseIdx ? log : { ...log, weight: Math.max(0, log.weight + delta) }
        )
        return { ...h, logs }
      }),
    }))
  }

  function updateSeries(entryDate: string, exerciseIdx: number, delta: number) {
    onUpdateDB((d) => ({
      ...d,
      history: d.history.map((h) => {
        if (h.date !== entryDate) return h
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

  function updateExpectedReps(entryDate: string, exerciseIdx: number, delta: number) {
    onUpdateDB((d) => ({
      ...d,
      history: d.history.map((h) => {
        if (h.date !== entryDate) return h
        const logs = h.logs.map((log, i) => {
          if (i !== exerciseIdx) return log
          const newExpected = Math.max(1, log.reps.expected + delta)
          return { ...log, reps: { expected: newExpected, actual: new Array(log.series).fill(newExpected) } }
        })
        return { ...h, logs }
      }),
    }))
  }

  function updateSeriesRep(entryDate: string, exerciseIdx: number, seriesIdx: number, reps: number) {
    onUpdateDB((d) => ({
      ...d,
      history: d.history.map((h) => {
        if (h.date !== entryDate) return h
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

  const FILTERS: { label: string; value: Filter }[] = [
    { label: 'Todos', value: 'TODOS' },
    { label: 'Lunes', value: 'LUNES' },
    { label: 'Miércoles', value: 'MIERCOLES' },
    { label: 'Viernes', value: 'VIERNES' },
  ]

  return (
    <>
      <div className="view-header">
        <h2>Historial</h2>
      </div>

      <div className="filter-bar">
        {FILTERS.map(({ label, value }) => (
          <button
            key={value}
            data-filter={value}
            onClick={() => setActiveFilter(value)}
            className={`filter-btn${activeFilter === value ? ' active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="view-body">
        {/* Empty state */}
        {displayed.length === 0 && (
          <div className="empty-state">No hay sesiones para este filtro</div>
        )}

        {/* History cards */}
        <div id="history-list">
        {displayed.map((entry, i) => {
          const expanded = expandedEntries.has(i)
          const editing = editingEntries.has(i)
          return (
            <div key={entry.date} className="card history-card">
              <div className="card-header" onClick={() => toggleExpand(i)}>
                <div className="card-title">
                  <span className="date-text">{entry.date}</span>
                  <span className={`type-badge ${entry.type}`}>{DAY_LABELS[entry.type]}</span>
                </div>
                <span className="card-subtitle">{entry.logs.length} ejercicios</span>
                <button
                  className="btn-icon"
                  onClick={(e) => { e.stopPropagation(); toggleEdit(i) }}
                  title="Editar"
                >
                  {editing ? '✅' : '✏️'}
                </button>
                <button
                  className="btn-icon"
                  onClick={(e) => { e.stopPropagation(); onModalRequest({ type: 'confirm-delete', entryDate: entry.date }) }}
                  title="Borrar"
                >
                  🗑️
                </button>
                <span className={`card-chevron${expanded ? ' open' : ''}`}>▾</span>
              </div>
              <div id={`h-body-${i}`} className={`card-body${expanded ? ' open' : ''}${editing ? ' editing' : ''}`}>
                {entry.logs.map((log, li) => (
                  <ExerciseLogCard
                    key={log.exercise_id}
                    log={log}
                    cardIdx={li}
                    expanded={true}
                    editing={editing}
                    onToggleExpand={() => {}}
                    variant="inline"
                    onWeightChange={editing ? (d) => updateWeight(entry.date, li, d) : undefined}
                    onSeriesChange={editing ? (d) => updateSeries(entry.date, li, d) : undefined}
                    onExpectedRepsChange={editing ? (d) => updateExpectedReps(entry.date, li, d) : undefined}
                    onRepUpdate={editing ? (si, reps) => updateSeriesRep(entry.date, li, si, reps) : undefined}
                  />
                ))}
              </div>
            </div>
          )
        })}
        </div>
      </div>
    </>
  )
}
