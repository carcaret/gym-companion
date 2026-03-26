import { useState } from 'react'

interface Props {
  onLogin: (username: string, password: string) => Promise<void>
}

export function LoginView({ onLogin }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await onLogin(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <label htmlFor="login-user">Usuario</label>
      <input id="login-user" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
      <label htmlFor="login-pwd">Contraseña</label>
      <input id="login-pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Cargando…' : 'Entrar'}
      </button>
    </form>
  )
}
