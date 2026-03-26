import { useState } from 'react'
import type { DB, DayOfWeek } from '../../../domain/shared/DB'

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

  function updateExerciseParam(entryDate: string, exerciseIdx: number, field: 'weight' | 'series', delta: number) {
    onUpdateDB((d) => ({
      ...d,
      history: d.history.map((h) => {
        if (h.date !== entryDate) return h
        const logs = h.logs.map((log, i) => {
          if (i !== exerciseIdx) return log
          if (field === 'weight') return { ...log, weight: Math.max(0, log.weight + delta) }
          return { ...log, series: Math.max(1, log.series + delta) }
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
    <div className="historial-view">
      {/* Filters */}
      <div className="history-filters">
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

      {/* Empty state */}
      {displayed.length === 0 && (
        <div className="empty-state">No hay sesiones para este filtro</div>
      )}

      {/* History cards */}
      {displayed.map((entry, i) => {
        const expanded = expandedEntries.has(i)
        const editing = editingEntries.has(i)
        return (
          <div key={entry.date} className="history-card">
            <div className="card-header" onClick={() => toggleExpand(i)}>
              <span className="date-text">{entry.date}</span>
              <span className={`type-badge ${entry.type}`}>{DAY_LABELS[entry.type]}</span>
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
            </div>
            <div id={`h-body-${i}`} className={`card-body${expanded ? ' open' : ''}${editing ? ' editing' : ''}`}>
              {entry.logs.map((log, li) => (
                <div key={log.exercise_id} className="exercise-row">
                  <span className="exercise-name">{log.name}</span>
                  <div className="param-row">
                    <span>Peso</span>
                    <button className="btn-icon" onClick={() => updateExerciseParam(entry.date, li, 'weight', -2.5)}>−</button>
                    <input className="param-input" type="number" value={log.weight} readOnly={!editing} onChange={() => {}} />
                    <button className="btn-icon" onClick={() => updateExerciseParam(entry.date, li, 'weight', 2.5)}>+</button>
                  </div>
                  <div className="param-row">
                    <span>Series</span>
                    <button className="btn-icon" onClick={() => updateExerciseParam(entry.date, li, 'series', -1)}>−</button>
                    <input className="param-input" type="number" value={log.series} readOnly={!editing} onChange={() => {}} />
                    <button className="btn-icon" onClick={() => updateExerciseParam(entry.date, li, 'series', 1)}>+</button>
                  </div>
                  <div className="param-row">
                    <span>Reps</span>
                    <span>{log.reps.actual.filter((r) => r !== null).join(', ') || log.reps.expected}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
