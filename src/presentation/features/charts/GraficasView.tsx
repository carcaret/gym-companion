import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  TimeScale,
  Tooltip,
  Legend,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import type { DB } from '../../../domain/shared/DB'
import { computeVolume, computeE1RM } from '../../../domain/workout/WorkoutMetrics'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, TimeScale, Tooltip, Legend)

type ChartType = 'line' | 'bar'

interface Props {
  db: DB
}

export function GraficasView({ db }: Props) {
  const [selectedExercise, setSelectedExercise] = useState('')
  const [chartType, setChartType] = useState<ChartType>('line')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 3)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])

  const canvas1Ref = useRef<HTMLCanvasElement>(null)
  const canvas2Ref = useRef<HTMLCanvasElement>(null)
  const chart1Ref = useRef<{ destroy(): void } | null>(null)
  const chart2Ref = useRef<{ destroy(): void } | null>(null)

  const exercisesWithHistory = useMemo(() => {
    const idSet = new Set<string>()
    for (const entry of db.history) {
      for (const log of entry.logs) {
        idSet.add(log.exercise_id)
      }
    }
    return [...idSet].map((id) => db.exercises[id]).filter(Boolean)
  }, [db.history, db.exercises])

  // Auto-select first exercise when history is available
  useEffect(() => {
    if (!selectedExercise && exercisesWithHistory.length > 0) {
      setSelectedExercise(exercisesWithHistory[0].id)
    }
  }, [exercisesWithHistory, selectedExercise])

  useEffect(() => {
    if (!canvas1Ref.current || !canvas2Ref.current || !selectedExercise) return

    const volumeData: { x: string; y: number }[] = []
    const e1rmData: { x: string; y: number }[] = []
    const weightData: { x: string; y: number }[] = []

    for (const entry of db.history) {
      if (entry.date < dateFrom || entry.date > dateTo) continue
      for (const log of entry.logs) {
        if (log.exercise_id !== selectedExercise) continue
        const vol = computeVolume(log)
        const e1rmVal = computeE1RM(log)
        if (vol > 0) volumeData.push({ x: entry.date, y: vol })
        if (e1rmVal > 0) e1rmData.push({ x: entry.date, y: Math.round(e1rmVal * 10) / 10 })
        if (log.weight > 0) weightData.push({ x: entry.date, y: log.weight })
      }
    }

    chart1Ref.current?.destroy()
    chart2Ref.current?.destroy()

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chart1Ref.current = new ChartJS(canvas1Ref.current, {
        type: chartType,
        data: {
          datasets: [
            { label: 'Volumen (kg)', data: volumeData as unknown[], borderColor: '#6c5ce7', backgroundColor: '#6c5ce740' },
            { label: 'e1RM (kg)', data: e1rmData as unknown[], borderColor: '#00b894', backgroundColor: '#00b89440' },
          ],
        },
        options: { animation: false, responsive: true, maintainAspectRatio: false, scales: { x: { type: 'time' } } },
      }) as { destroy(): void }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chart2Ref.current = new ChartJS(canvas2Ref.current, {
        type: chartType,
        data: {
          datasets: [
            { label: 'Peso (kg)', data: weightData as unknown[], borderColor: '#fdcb6e', backgroundColor: '#fdcb6e40' },
          ],
        },
        options: { animation: false, responsive: true, maintainAspectRatio: false, scales: { x: { type: 'time' } } },
      }) as { destroy(): void }
    } catch {
      // ignore chart errors when canvas is hidden
    }

    return () => {
      chart1Ref.current?.destroy()
      chart1Ref.current = null
      chart2Ref.current?.destroy()
      chart2Ref.current = null
    }
  }, [db.history, selectedExercise, chartType, dateFrom, dateTo])

  return (
    <>
      <div className="view-header">
        <h2>Gráficas</h2>
      </div>

      <div className="view-body">
        <div className="graficas-controls">
          <div className="date-range">
            <div className="input-group small">
              <label htmlFor="chart-from">Desde</label>
              <input
                id="chart-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="input-group small">
              <label htmlFor="chart-to">Hasta</label>
              <input
                id="chart-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          <div className="input-group">
            <select
              id="chart-exercise-select"
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
            >
              <option value="">-- Selecciona un ejercicio --</option>
              {exercisesWithHistory.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>
          <div className="chart-toggle">
            <button
              data-chart="line"
              className={`toggle-btn${chartType === 'line' ? ' active' : ''}`}
              onClick={() => setChartType('line')}
            >
              Líneas
            </button>
            <button
              data-chart="bar"
              className={`toggle-btn${chartType === 'bar' ? ' active' : ''}`}
              onClick={() => setChartType('bar')}
            >
              Barras
            </button>
          </div>
        </div>

        <h3 className="chart-section-title">Volumen y e1RM</h3>
        <div className="chart-container">
          {selectedExercise
            ? <canvas id="chart-canvas" ref={canvas1Ref} />
            : <p className="chart-placeholder">Selecciona un ejercicio para ver la gráfica</p>
          }
        </div>
        <h3 className="chart-section-title">Evolución del Peso</h3>
        <div className="chart-container">
          {selectedExercise
            ? <canvas id="chart-canvas-weight" ref={canvas2Ref} />
            : <p className="chart-placeholder">Selecciona un ejercicio para ver la gráfica</p>
          }
        </div>
      </div>
    </>
  )
}
