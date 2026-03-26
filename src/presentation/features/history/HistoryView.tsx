import { useState } from 'react'
import type { DayOfWeek, HistoryEntry } from '../../../domain/shared/DB'

const DAY_LABELS: Record<DayOfWeek, string> = { LUNES: 'Lunes', MIERCOLES: 'Miércoles', VIERNES: 'Viernes' }

interface Props {
  entries: HistoryEntry[]
  onFilter: (day: DayOfWeek | null) => void
  activeFilter: DayOfWeek | null
}

function HistoryEntryRow({ entry }: { entry: HistoryEntry }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="history-entry">
      <button className="history-entry-header" onClick={() => setExpanded((v) => !v)}>
        <span>{entry.date}</span>
        <span>{DAY_LABELS[entry.type]}</span>
      </button>
      {expanded && (
        <ul className="history-entry-logs">
          {entry.logs.map((log) => (
            <li key={log.exercise_id}>{log.name} — {log.series}×{log.reps.expected} @ {log.weight}kg</li>
          ))}
        </ul>
      )}
    </div>
  )
}

const FILTERS: { label: string; value: DayOfWeek | null }[] = [
  { label: 'Todos', value: null },
  { label: 'Lunes', value: 'LUNES' },
  { label: 'Miércoles', value: 'MIERCOLES' },
  { label: 'Viernes', value: 'VIERNES' },
]

export function HistoryView({ entries, onFilter, activeFilter }: Props) {
  return (
    <div className="history-view">
      <div className="history-filters">
        {FILTERS.map(({ label, value }) => (
          <button
            key={label}
            onClick={() => onFilter(value)}
            aria-pressed={activeFilter === value}
          >
            {label}
          </button>
        ))}
      </div>
      {entries.length === 0 ? (
        <p>Sin entrenamientos registrados</p>
      ) : (
        entries.map((entry) => <HistoryEntryRow key={entry.date} entry={entry} />)
      )}
    </div>
  )
}
