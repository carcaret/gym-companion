import { useState } from 'react'
import type { DB, DayOfWeek } from '../../../domain/shared/DB'
import { WorkoutDetailView } from '../workout/WorkoutDetailView'

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
  const [selectedEntryDate, setSelectedEntryDate] = useState<string | null>(null)

  const sorted = [...db.history].sort((a, b) => b.date.localeCompare(a.date))
  const displayed = activeFilter === 'TODOS' ? sorted : sorted.filter((e) => e.type === activeFilter)

  const selectedEntry = selectedEntryDate ? db.history.find((h) => h.date === selectedEntryDate) ?? null : null

  const FILTERS: { label: string; value: Filter }[] = [
    { label: 'Todos', value: 'TODOS' },
    { label: 'Lunes', value: 'LUNES' },
    { label: 'Miércoles', value: 'MIERCOLES' },
    { label: 'Viernes', value: 'VIERNES' },
  ]

  // ── Detail view ─────────────────────────────────────────────────────

  if (selectedEntry) {
    return (
      <>
        <div className="view-header">
          <h2>Historial</h2>
        </div>
        <div className="view-body">
          <WorkoutDetailView
            db={db}
            entry={selectedEntry}
            onUpdateDB={onUpdateDB}
            canAddRemoveExercises={false}
            canFinishWorkout={false}
            onBack={() => setSelectedEntryDate(null)}
          />
        </div>
      </>
    )
  }

  // ── List view ───────────────────────────────────────────────────────

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

        {/* History cards (compact list) */}
        <div id="history-list">
          {displayed.map((entry) => (
            <div
              key={entry.date}
              className="card history-card"
              onClick={() => setSelectedEntryDate(entry.date)}
              style={{ cursor: 'pointer' }}
            >
              <div className="card-header">
                <div className="card-title">
                  <span className="date-text">{entry.date}</span>
                  <span className={`type-badge ${entry.type}`}>{DAY_LABELS[entry.type]}</span>
                </div>
                <span className="card-subtitle">{entry.logs.length} ejercicios</span>
                <button
                  className="btn-icon"
                  onClick={(e) => { e.stopPropagation(); onModalRequest({ type: 'confirm-delete', entryDate: entry.date }) }}
                  title="Borrar"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
