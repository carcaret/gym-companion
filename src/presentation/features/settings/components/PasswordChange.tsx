import { useState } from 'react'

interface Props {
  onChangePassword: (current: string, next: string) => Promise<void>
}

export function PasswordChange({ onChangePassword }: Props) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (next !== confirm) { setError('Las contraseñas no coinciden'); return }
    try {
      await onChangePassword(current, next)
      setCurrent(''); setNext(''); setConfirm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="pwd-current">Contraseña actual</label>
      <input id="pwd-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      <label htmlFor="pwd-new">Nueva contraseña</label>
      <input id="pwd-new" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
      <label htmlFor="pwd-confirm">Confirmar nueva contraseña</label>
      <input id="pwd-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Cambiar contraseña</button>
    </form>
  )
}
