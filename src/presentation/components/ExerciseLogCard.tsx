import type { ReactNode } from 'react'
import type { ExerciseLog } from '../../domain/shared/DB'

interface ExerciseLogCardProps {
  log: ExerciseLog
  cardIdx: number
  expanded: boolean
  editing: boolean
  onToggleExpand: () => void
  onRepUpdate?: (seriesIdx: number, reps: number) => void
  onWeightChange?: (delta: number) => void
  onSeriesChange?: (delta: number) => void
  onExpectedRepsChange?: (delta: number) => void
  actionSlot?: ReactNode
  variant?: 'card' | 'inline'
}

export function ExerciseLogCard({
  log,
  cardIdx,
  expanded,
  editing,
  onToggleExpand,
  onRepUpdate,
  onWeightChange,
  onSeriesChange,
  onExpectedRepsChange,
  actionSlot,
  variant = 'card',
}: ExerciseLogCardProps) {
  const i = cardIdx
  const actualesRegistradas = log.reps.actual.filter((r): r is number => r !== null)

  function buildSubtitle() {
    const parts: string[] = [`${log.weight}kg`, `obj ${log.reps.expected}`]
    if (actualesRegistradas.length > 0) {
      parts.push(`real: ${actualesRegistradas.join(', ')}`)
    } else {
      parts.push(`${log.series} series`)
    }
    return parts.join(' · ')
  }

  // ── Shared body content ────────────────────────────────────

  function renderSeriesRows() {
    return Array.from({ length: log.series }).map((_, si) => {
      const val = log.reps.actual[si] ?? log.reps.expected
      return (
        <div key={si} className="series-row">
          <span className="series-label">{si + 1}</span>
          {editing && onRepUpdate ? (
            <>
              <button className="btn-icon" onClick={() => onRepUpdate(si, Math.max(0, val - 1))}>−</button>
              <input
                id={`rep-${i}-${si}`}
                className="series-input"
                type="number"
                min={0}
                value={val}
                onChange={(e) => onRepUpdate(si, Number(e.target.value))}
              />
              <button className="btn-icon" onClick={() => onRepUpdate(si, val + 1)}>+</button>
            </>
          ) : (
            <span className="series-value">{val}</span>
          )}
        </div>
      )
    })
  }

  function renderParamRows() {
    return (
      <>
        <div className="param-row">
          <label>Peso</label>
          {editing && onWeightChange ? (
            <>
              <button className="btn-icon" onClick={() => onWeightChange(-2.5)}>−</button>
              <input className="param-input" type="number" min={0} step={2.5} value={log.weight} readOnly />
              <button className="btn-icon" onClick={() => onWeightChange(2.5)}>+</button>
            </>
          ) : (
            <span className="param-input">{log.weight} kg</span>
          )}
        </div>
        <div className="param-row">
          <label>Series</label>
          {editing && onSeriesChange ? (
            <>
              <button className="btn-icon" onClick={() => onSeriesChange(-1)}>−</button>
              <input className="param-input" type="number" min={1} value={log.series} readOnly />
              <button className="btn-icon" onClick={() => onSeriesChange(1)}>+</button>
            </>
          ) : (
            <span className="param-input">{log.series}</span>
          )}
        </div>
        <div className="param-row">
          <label>Reps obj.</label>
          {editing && onExpectedRepsChange ? (
            <>
              <button className="btn-icon" onClick={() => onExpectedRepsChange(-1)}>−</button>
              <input className="param-input" type="number" min={1} value={log.reps.expected} readOnly />
              <button className="btn-icon" onClick={() => onExpectedRepsChange(1)}>+</button>
            </>
          ) : (
            <span className="param-input">
              obj: {log.reps.expected}
              {actualesRegistradas.length > 0 && (
                <> · real: {actualesRegistradas.join(', ')}</>
              )}
            </span>
          )}
        </div>
      </>
    )
  }

  // ── Variant: inline ────────────────────────────────────────

  if (variant === 'inline') {
    return (
      <div id={`exercise-inline-${i}`} className="exercise-row">
        <span className="exercise-name">{log.name}</span>
        {renderSeriesRows()}
        {renderParamRows()}
        {actionSlot}
      </div>
    )
  }

  // ── Variant: card (default) ────────────────────────────────

  return (
    <div id={`exercise-card-${i}`} className="card">
      <div className="card-header" onClick={onToggleExpand}>
        <div className="card-title">{log.name}</div>
        <span className="card-subtitle">{buildSubtitle()}</span>
        <span className={`card-chevron${expanded ? ' open' : ''}`}>▾</span>
      </div>
      <div id={`body-${i}`} className={`card-body${expanded ? ' open' : ''}`}>
        {renderSeriesRows()}
        {renderParamRows()}
        {actionSlot}
      </div>
    </div>
  )
}
