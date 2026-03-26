import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginView } from '../LoginView'
import { AuthError } from '../../../../application/auth/AuthUseCases'

describe('LoginView', () => {
  it('renderiza campos usuario y contraseña', () => {
    render(<LoginView onLogin={vi.fn()} />)
    expect(screen.getByLabelText(/usuario/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument()
  })

  it('llama onLogin con usuario y contraseña al enviar', async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined)
    render(<LoginView onLogin={onLogin} />)
    await userEvent.type(screen.getByLabelText(/usuario/i), 'carlos')
    await userEvent.type(screen.getByLabelText(/contraseña/i), 'password')
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }))
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith('carlos', 'password'))
  })

  it('muestra error si onLogin lanza AuthError', async () => {
    const onLogin = vi.fn().mockRejectedValue(new AuthError('Credenciales incorrectas'))
    render(<LoginView onLogin={onLogin} />)
    await userEvent.type(screen.getByLabelText(/usuario/i), 'bad')
    await userEvent.type(screen.getByLabelText(/contraseña/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }))
    expect(await screen.findByText(/credenciales incorrectas/i)).toBeInTheDocument()
  })

  it('deshabilita el botón mientras está cargando', async () => {
    let resolve!: () => void
    const onLogin = vi.fn().mockReturnValue(new Promise<void>((r) => { resolve = r }))
    render(<LoginView onLogin={onLogin} />)
    await userEvent.type(screen.getByLabelText(/usuario/i), 'carlos')
    await userEvent.type(screen.getByLabelText(/contraseña/i), 'password')
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }))
    expect(screen.getByRole('button', { name: /cargando/i })).toBeDisabled()
    resolve()
  })
})
