import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BottomNav } from '../BottomNav'

describe('BottomNav', () => {
  it('renderiza 4 pestañas', () => {
    render(<BottomNav activeView="hoy" onNavigate={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(4)
  })

  it('llama onNavigate con "historial" al hacer click en Historial', async () => {
    const onNavigate = vi.fn()
    render(<BottomNav activeView="hoy" onNavigate={onNavigate} />)
    await userEvent.click(screen.getByText(/historial/i))
    expect(onNavigate).toHaveBeenCalledWith('historial')
  })

  it('la pestaña activa tiene aria-current="page"', () => {
    render(<BottomNav activeView="graficas" onNavigate={vi.fn()} />)
    const active = screen.getByRole('button', { name: /gráficas/i })
    expect(active).toHaveAttribute('aria-current', 'page')
  })
})
