import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GitHubConfig } from '../components/GitHubConfig'

describe('GitHubConfig', () => {
  beforeEach(() => localStorage.clear())

  it('renderiza los campos repo, branch, path y token', () => {
    render(<GitHubConfig onSave={vi.fn()} onTest={vi.fn()} />)
    expect(screen.getByLabelText(/repositorio/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/rama/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/ruta/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/token/i)).toBeInTheDocument()
  })

  it('usa "master" y "db.json" como valores por defecto', () => {
    render(<GitHubConfig onSave={vi.fn()} onTest={vi.fn()} />)
    expect(screen.getByLabelText(/rama/i)).toHaveValue('master')
    expect(screen.getByLabelText(/ruta/i)).toHaveValue('db.json')
  })

  it('llama onSave con repo, branch, path y token al guardar', async () => {
    const onSave = vi.fn()
    render(<GitHubConfig onSave={onSave} onTest={vi.fn()} />)
    await userEvent.clear(screen.getByLabelText(/repositorio/i))
    await userEvent.type(screen.getByLabelText(/repositorio/i), 'user/repo')
    await userEvent.type(screen.getByLabelText(/token/i), 'ghp_tok')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ repo: 'user/repo', token: 'ghp_tok' })
    )
  })
})
