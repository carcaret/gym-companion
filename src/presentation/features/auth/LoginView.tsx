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
    <div className="login-container">
      <div className="login-logo">🏋️</div>
      <h1 className="login-title">Gym Companion</h1>
      <p className="login-subtitle">Tu compañero de entreno</p>
      <form id="login-form" onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="login-user">Usuario</label>
          <input
            id="login-user"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div className="input-group">
          <label htmlFor="login-pass">Contraseña</label>
          <input
            id="login-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div id="login-error" hidden={!error}>
          {error && <span>Datos incorrectos</span>}
        </div>
        <button id="login-btn" type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Cargando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
