import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExerciseLogCard } from '../ExerciseLogCard'
import type { ExerciseLog } from '../../../domain/shared/DB'

const baselog: ExerciseLog = {
  exercise_id: 'press_banca',
  name: 'Press de Banca',
  series: 3,
  reps: { expected: 10, actual: [10, 9, 8] },
  weight: 80,
}

const logNullActual: ExerciseLog = {
  ...baselog,
  reps: { expected: 10, actual: [null, null, null] },
}

// ── Grupo A — Variante card ──────────────────────────────────────────

describe('ExerciseLogCard — variante card', () => {
  it('renderiza .card con .card-header y nombre del ejercicio', () => {
    render(
      <ExerciseLogCard log={baselog} cardIdx={0} expanded={false} editing={false} onToggleExpand={vi.fn()} />
    )
    const card = document.querySelector('.card')
    expect(card).toBeInTheDocument()
    expect(card!.querySelector('.card-header')).toBeInTheDocument()
    expect(screen.getByText('Press de Banca')).toBeInTheDocument()
  })

  it('subtitle muestra peso, reps objetivo y reps reales desglosadas', () => {
    render(
      <ExerciseLogCard log={baselog} cardIdx={0} expanded={false} editing={false} onToggleExpand={vi.fn()} />
    )
    const subtitle = document.querySelector('.card-subtitle')!
    expect(subtitle.textContent).toMatch(/80kg/)
    expect(subtitle.textContent).toMatch(/obj\s*10/)
    expect(subtitle.textContent).toMatch(/real.*10.*9.*8/)
  })

  it('subtitle sin reps reales cuando actual es todo null', () => {
    render(
      <ExerciseLogCard log={logNullActual} cardIdx={0} expanded={false} editing={false} onToggleExpand={vi.fn()} />
    )
    const subtitle = document.querySelector('.card-subtitle')!
    expect(subtitle.textContent).toMatch(/80kg/)
    expect(subtitle.textContent).toMatch(/obj\s*10/)
    expect(subtitle.textContent).toMatch(/3\s*series/)
    expect(subtitle.textContent).not.toMatch(/real/)
  })

  it('.card-body tiene clase .open cuando expanded=true', () => {
    render(
      <ExerciseLogCard log={baselog} cardIdx={0} expanded={true} editing={false} onToggleExpand={vi.fn()} />
    )
    expect(document.getElementById('body-0')).toHaveClass('open')
  })

  it('.card-body no tiene .open cuando expanded=false', () => {
    render(
      <ExerciseLogCard log={baselog} cardIdx={0} expanded={false} editing={false} onToggleExpand={vi.fn()} />
    )
    expect(document.getElementById('body-0')).not.toHaveClass('open')
  })

  it('click en header llama onToggleExpand', async () => {
    const onToggle = vi.fn()
    render(
      <ExerciseLogCard log={baselog} cardIdx={0} expanded={false} editing={false} onToggleExpand={onToggle} />
    )
    await userEvent.click(document.querySelector('.card-header')!)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})

// ── Grupo B — Variante inline ────────────────────────────────────────

describe('ExerciseLogCard — variante inline', () => {
  it('renderiza .exercise-row (no .card)', () => {
    render(
      <ExerciseLogCard log={baselog} cardIdx={0} expanded={true} editing={false} onToggleExpand={vi.fn()} variant="inline" />
    )
    expect(document.querySelector('.exercise-row')).toBeInTheDocument()
    expect(document.querySelector('.card')).not.toBeInTheDocument()
  })

  it('muestra nombre del ejercicio como .exercise-name', () => {
    render(
      <ExerciseLogCard log={baselog} cardIdx={0} expanded={true} editing={false} onToggleExpand={vi.fn()} variant="inline" />
    )
    const name = document.querySelector('.exercise-name')
    expect(name).toBeInTheDocument()
    expect(name!.textContent).toBe('Press de Banca')
  })

  it('muestra filas de params con peso, series, reps obj', () => {
    render(
      <ExerciseLogCard log={baselog} cardIdx={0} expanded={true} editing={false} onToggleExpand={vi.fn()} variant="inline" />
    )
    const text = document.querySelector('.exercise-row')!.textContent!
    expect(text).toMatch(/Peso/)
    expect(text).toMatch(/80/)
    expect(text).toMatch(/Series/)
    expect(text).toMatch(/3/)
    expect(text).toMatch(/Reps/)
    expect(text).toMatch(/obj.*10/)
  })

  it('muestra reps reales desglosadas', () => {
    render(
      <ExerciseLogCard log={baselog} cardIdx={0} expanded={true} editing={false} onToggleExpand={vi.fn()} variant="inline" />
    )
    const text = document.querySelector('.exercise-row')!.textContent!
    expect(text).toMatch(/real.*10.*9.*8/)
  })
})

// ── Grupo C — Modo view (editing=false) ──────────────────────────────

describe('ExerciseLogCard — modo view', () => {
  it('no renderiza botones btn-icon en param-rows', () => {
    render(
      <ExerciseLogCard log={baselog} cardIdx={0} expanded={true} editing={false} onToggleExpand={vi.fn()} />
    )
    const paramButtons = document.querySelectorAll('.param-row button.btn-icon')
    expect(paramButtons).toHaveLength(0)
  })

  it('no renderiza inputs editables en series-rows (muestra spans)', () => {
    render(
      <ExerciseLogCard log={baselog} cardIdx={0} expanded={true} editing={false} onToggleExpand={vi.fn()} />
    )
    const seriesInputs = document.querySelectorAll('.series-row input')
    expect(seriesInputs).toHaveLength(0)
    const seriesSpans = document.querySelectorAll('.series-row .series-value')
    expect(seriesSpans.length).toBeGreaterThan(0)
  })

  it('valores de params son <span> (no <input>)', () => {
    render(
      <ExerciseLogCard log={baselog} cardIdx={0} expanded={true} editing={false} onToggleExpand={vi.fn()} />
    )
    const paramInputs = document.querySelectorAll('.param-row input')
    expect(paramInputs).toHaveLength(0)
    const paramSpans = document.querySelectorAll('.param-row span.param-input')
    expect(paramSpans.length).toBeGreaterThan(0)
  })
})

// ── Grupo D — Modo edit (editing=true, callbacks) ────────────────────

describe('ExerciseLogCard — modo edit', () => {
  it('renderiza botones +/- en param-rows (peso, series, reps obj)', () => {
    render(
      <ExerciseLogCard
        log={baselog} cardIdx={0} expanded={true} editing={true} onToggleExpand={vi.fn()}
        onWeightChange={vi.fn()} onSeriesChange={vi.fn()} onExpectedRepsChange={vi.fn()} onRepUpdate={vi.fn()}
      />
    )
    const paramButtons = document.querySelectorAll('.param-row button.btn-icon')
    // 3 param-rows × 2 buttons each = 6
    expect(paramButtons).toHaveLength(6)
  })

  it('renderiza inputs con +/- por cada serie (reps reales)', () => {
    render(
      <ExerciseLogCard
        log={baselog} cardIdx={0} expanded={true} editing={true} onToggleExpand={vi.fn()}
        onRepUpdate={vi.fn()} onWeightChange={vi.fn()} onSeriesChange={vi.fn()} onExpectedRepsChange={vi.fn()}
      />
    )
    const seriesInputs = document.querySelectorAll('.series-row input')
    expect(seriesInputs).toHaveLength(3) // 3 series
    const seriesButtons = document.querySelectorAll('.series-row button.btn-icon')
    expect(seriesButtons).toHaveLength(6) // 3 series × 2
  })

  it('click en + de peso llama onWeightChange(2.5)', async () => {
    const onWeight = vi.fn()
    render(
      <ExerciseLogCard
        log={baselog} cardIdx={0} expanded={true} editing={true} onToggleExpand={vi.fn()}
        onWeightChange={onWeight} onSeriesChange={vi.fn()} onExpectedRepsChange={vi.fn()} onRepUpdate={vi.fn()}
      />
    )
    // First param-row is Peso, second button is +
    const pesoRow = document.querySelectorAll('.param-row')[0]
    const plusBtn = pesoRow.querySelectorAll('button.btn-icon')[1]
    await userEvent.click(plusBtn)
    expect(onWeight).toHaveBeenCalledWith(2.5)
  })

  it('click en - de peso llama onWeightChange(-2.5)', async () => {
    const onWeight = vi.fn()
    render(
      <ExerciseLogCard
        log={baselog} cardIdx={0} expanded={true} editing={true} onToggleExpand={vi.fn()}
        onWeightChange={onWeight} onSeriesChange={vi.fn()} onExpectedRepsChange={vi.fn()} onRepUpdate={vi.fn()}
      />
    )
    const pesoRow = document.querySelectorAll('.param-row')[0]
    const minusBtn = pesoRow.querySelectorAll('button.btn-icon')[0]
    await userEvent.click(minusBtn)
    expect(onWeight).toHaveBeenCalledWith(-2.5)
  })

  it('click en + de reps obj llama onExpectedRepsChange(1)', async () => {
    const onExpReps = vi.fn()
    render(
      <ExerciseLogCard
        log={baselog} cardIdx={0} expanded={true} editing={true} onToggleExpand={vi.fn()}
        onWeightChange={vi.fn()} onSeriesChange={vi.fn()} onExpectedRepsChange={onExpReps} onRepUpdate={vi.fn()}
      />
    )
    // Third param-row is Reps obj, second button is +
    const repsRow = document.querySelectorAll('.param-row')[2]
    const plusBtn = repsRow.querySelectorAll('button.btn-icon')[1]
    await userEvent.click(plusBtn)
    expect(onExpReps).toHaveBeenCalledWith(1)
  })

  it('click en +/- de serie individual llama onRepUpdate(seriesIdx, newValue)', async () => {
    const onRep = vi.fn()
    render(
      <ExerciseLogCard
        log={baselog} cardIdx={0} expanded={true} editing={true} onToggleExpand={vi.fn()}
        onWeightChange={vi.fn()} onSeriesChange={vi.fn()} onExpectedRepsChange={vi.fn()} onRepUpdate={onRep}
      />
    )
    // First series-row, + button (second btn-icon)
    const seriesRow0 = document.querySelectorAll('.series-row')[0]
    const plusBtn = seriesRow0.querySelectorAll('button.btn-icon')[1]
    await userEvent.click(plusBtn)
    // actual[0] is 10, so +1 = 11
    expect(onRep).toHaveBeenCalledWith(0, 11)
  })

  it('no renderiza controles de params si el callback correspondiente no se pasa (aunque editing=true)', () => {
    render(
      <ExerciseLogCard
        log={baselog} cardIdx={0} expanded={true} editing={true} onToggleExpand={vi.fn()}
        // No callbacks passed
      />
    )
    const paramButtons = document.querySelectorAll('.param-row button.btn-icon')
    expect(paramButtons).toHaveLength(0)
    const seriesButtons = document.querySelectorAll('.series-row button.btn-icon')
    expect(seriesButtons).toHaveLength(0)
  })
})

// ── Grupo E — actionSlot ─────────────────────────────────────────────

describe('ExerciseLogCard — actionSlot', () => {
  it('renderiza actionSlot al final del body cuando se pasa', () => {
    render(
      <ExerciseLogCard
        log={baselog} cardIdx={0} expanded={true} editing={false} onToggleExpand={vi.fn()}
        actionSlot={<button className="btn-danger">Quitar de rutina</button>}
      />
    )
    expect(screen.getByText('Quitar de rutina')).toBeInTheDocument()
  })

  it('no renderiza nada extra cuando actionSlot es undefined', () => {
    render(
      <ExerciseLogCard log={baselog} cardIdx={0} expanded={true} editing={false} onToggleExpand={vi.fn()} />
    )
    expect(screen.queryByText('Quitar de rutina')).not.toBeInTheDocument()
  })
})
