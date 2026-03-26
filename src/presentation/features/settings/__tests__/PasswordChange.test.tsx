import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PasswordChange } from '../components/PasswordChange'
import { AuthError } from '../../../../application/auth/AuthUseCases'

describe('PasswordChange', () => {
  it('renderiza formulario con los 3 campos', () => {
    render(<PasswordChange onChangePassword={vi.fn()} />)
    expect(screen.getByLabelText('Contraseña actual')).toBeInTheDocument()
    expect(screen.getByLabelText('Nueva contraseña')).toBeInTheDocument()
    expect(screen.getByLabelText(/confirmar/i)).toBeInTheDocument()
  })

  it('llama onChangePassword con la contraseña actual y nueva al enviar', async () => {
    const onChangePassword = vi.fn().mockResolvedValue(undefined)
    render(<PasswordChange onChangePassword={onChangePassword} />)
    await userEvent.type(screen.getByLabelText('Contraseña actual'), 'vieja')
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'nueva')
    await userEvent.type(screen.getByLabelText(/confirmar/i), 'nueva')
    await userEvent.click(screen.getByRole('button', { name: /cambiar/i }))
    await waitFor(() => expect(onChangePassword).toHaveBeenCalledWith('vieja', 'nueva'))
  })

  it('muestra error si las contraseñas nuevas no coinciden', async () => {
    render(<PasswordChange onChangePassword={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'nueva')
    await userEvent.type(screen.getByLabelText(/confirmar/i), 'distinta')
    await userEvent.click(screen.getByRole('button', { name: /cambiar/i }))
    expect(await screen.findByText(/no coinciden/i)).toBeInTheDocument()
  })

  it('muestra error si onChangePassword lanza AuthError', async () => {
    const onChangePassword = vi.fn().mockRejectedValue(new AuthError('Contraseña incorrecta'))
    render(<PasswordChange onChangePassword={onChangePassword} />)
    await userEvent.type(screen.getByLabelText('Contraseña actual'), 'wrong')
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'nueva')
    await userEvent.type(screen.getByLabelText(/confirmar/i), 'nueva')
    await userEvent.click(screen.getByRole('button', { name: /cambiar/i }))
    expect(await screen.findByText(/contraseña incorrecta/i)).toBeInTheDocument()
  })
})
