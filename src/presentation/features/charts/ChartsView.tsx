import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import type { ChartData } from '../../../application/charts/GetChartDataUseCase'
import type { Exercise } from '../../../domain/shared/DB'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale)

interface DateRange {
  from: string
  to: string
}

interface Props {
  exercises: Record<string, Exercise>
  chartData: ChartData
  selectedExercise: string
  onExerciseChange: (id: string) => void
  onDateChange: (range: DateRange) => void
  dateFrom: string
  dateTo: string
}

export function ChartsView({ exercises, chartData, selectedExercise, onExerciseChange, onDateChange, dateFrom, dateTo }: Props) {
  const hasData = chartData.volume.length > 0 || chartData.e1rm.length > 0

  const lineData = {
    datasets: [
      { label: 'Volumen (kg)', data: chartData.volume, borderColor: '#6c5ce7' },
      { label: 'e1RM (kg)', data: chartData.e1rm, borderColor: '#00b894' },
    ],
  }

  return (
    <div className="charts-view">
      <select
        value={selectedExercise}
        onChange={(e) => onExerciseChange(e.target.value)}
        aria-label="Ejercicio"
      >
        <option value="">— Selecciona ejercicio —</option>
        {Object.values(exercises).map((ex) => (
          <option key={ex.id} value={ex.id}>{ex.name}</option>
        ))}
      </select>
      <div className="date-range">
        <label htmlFor="chart-from">Desde</label>
        <input id="chart-from" type="date" value={dateFrom} onChange={(e) => onDateChange({ from: e.target.value, to: dateTo })} />
        <label htmlFor="chart-to">Hasta</label>
        <input id="chart-to" type="date" value={dateTo} onChange={(e) => onDateChange({ from: dateFrom, to: e.target.value })} />
      </div>
      {selectedExercise && !hasData ? (
        <p>Sin datos para este ejercicio</p>
      ) : hasData ? (
        <Line data={lineData} options={{ scales: { x: { type: 'time' } } }} />
      ) : null}
    </div>
  )
}
