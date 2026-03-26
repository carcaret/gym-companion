import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChartsView } from '../ChartsView'
import type { ChartData } from '../../../../application/charts/GetChartDataUseCase'

vi.mock('react-chartjs-2', () => ({ Line: ({ data }: { data: unknown }) => <canvas data-testid="chart" data-points={JSON.stringify(data)} /> }))

const exercises = {
  curl_biceps: { id: 'curl_biceps', name: 'Curl de bíceps' },
  press_banca: { id: 'press_banca', name: 'Press de banca' },
}

const emptyData: ChartData = { volume: [], e1rm: [], weight: [] }
const dataWithPoints: ChartData = {
  volume: [{ x: '2026-01-05', y: 1800 }],
  e1rm: [{ x: '2026-01-05', y: 80 }],
  weight: [{ x: '2026-01-05', y: 60 }],
}

describe('ChartsView', () => {
  it('renderiza el selector de ejercicio con las opciones disponibles', () => {
    render(<ChartsView exercises={exercises} chartData={emptyData} selectedExercise="" onExerciseChange={vi.fn()} onDateChange={vi.fn()} dateFrom="" dateTo="" />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText('Curl de bíceps')).toBeInTheDocument()
    expect(screen.getByText('Press de banca')).toBeInTheDocument()
  })

  it('renderiza los selectores de fecha desde y hasta', () => {
    render(<ChartsView exercises={exercises} chartData={emptyData} selectedExercise="" onExerciseChange={vi.fn()} onDateChange={vi.fn()} dateFrom="" dateTo="" />)
    expect(screen.getByLabelText(/desde/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument()
  })

  it('muestra estado vacío si no hay datos', () => {
    render(<ChartsView exercises={exercises} chartData={emptyData} selectedExercise="curl_biceps" onExerciseChange={vi.fn()} onDateChange={vi.fn()} dateFrom="" dateTo="" />)
    expect(screen.getByText(/sin datos/i)).toBeInTheDocument()
  })

  it('renderiza la gráfica cuando hay datos', () => {
    render(<ChartsView exercises={exercises} chartData={dataWithPoints} selectedExercise="curl_biceps" onExerciseChange={vi.fn()} onDateChange={vi.fn()} dateFrom="" dateTo="" />)
    expect(screen.getByTestId('chart')).toBeInTheDocument()
  })

  it('llama onExerciseChange al seleccionar un ejercicio', async () => {
    const onExerciseChange = vi.fn()
    render(<ChartsView exercises={exercises} chartData={emptyData} selectedExercise="" onExerciseChange={onExerciseChange} onDateChange={vi.fn()} dateFrom="" dateTo="" />)
    await userEvent.selectOptions(screen.getByRole('combobox'), 'curl_biceps')
    expect(onExerciseChange).toHaveBeenCalledWith('curl_biceps')
  })
})
