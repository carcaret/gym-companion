import { useState } from 'react'
import type { DB } from '../../../domain/shared/DB'

interface Props {
  db: DB
  onChangePassword: (oldPass: string, newPass: string) => Promise<void>
  onLogout: () => void
}

export function AjustesView({ db, onChangePassword, onLogout }: Props) {
  const [repo, setRepo] = useState('')
  const [branch, setBranch] = useState('main')
  const [path, setPath] = useState('db.json')
  const [pat, setPat] = useState('')
  const [githubStatus, setGithubStatus] = useState<string | null>(null)

  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [passStatus, setPassStatus] = useState<string | null>(null)

  async function handleChangePass() {
    setPassStatus(null)
    try {
      await onChangePassword(oldPass, newPass)
      setPassStatus('Contraseña cambiada correctamente')
      setOldPass('')
      setNewPass('')
    } catch {
      setPassStatus('Contraseña actual incorrecta')
    }
  }

  function handleExport() {
    const data = JSON.stringify(db, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().split('T')[0]
    a.href = url
    a.download = `gym_companion_backup_${date}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="view-header">
        <h2>Ajustes</h2>
      </div>

      <div className="view-body settings-body">

        {/* GitHub */}
        <section className="settings-section">
          <h3>GitHub API</h3>
          <div className="input-group">
            <label htmlFor="set-repo">Repositorio (usuario/repo)</label>
            <input id="set-repo" type="text" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="usuario/repo" />
          </div>
          <div className="input-group">
            <label htmlFor="set-branch">Rama</label>
            <input id="set-branch" type="text" value={branch} onChange={(e) => setBranch(e.target.value)} />
          </div>
          <div className="input-group">
            <label htmlFor="set-path">Ruta del archivo</label>
            <input id="set-path" type="text" value={path} onChange={(e) => setPath(e.target.value)} />
          </div>
          <div className="input-group">
            <label htmlFor="set-pat">Personal Access Token</label>
            <input id="set-pat" type="password" value={pat} onChange={(e) => setPat(e.target.value)} placeholder="ghp_..." />
          </div>
          <button id="save-github-btn" className="btn-primary" onClick={() => setGithubStatus('Configuración guardada')}>
            Guardar configuración
          </button>
          <button id="test-github-btn" className="btn-secondary" type="button" onClick={() => setGithubStatus('Probando conexión...')}>
            Probar conexión
          </button>
          {githubStatus && <p id="github-status" className="status-msg">{githubStatus}</p>}
        </section>

        {/* Cambiar contraseña */}
        <section className="settings-section">
          <h3>Cambiar contraseña</h3>
          <div className="input-group">
            <label htmlFor="set-old-pass">Contraseña actual</label>
            <input
              id="set-old-pass"
              type="password"
              value={oldPass}
              onChange={(e) => setOldPass(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label htmlFor="set-new-pass">Contraseña nueva</label>
            <input
              id="set-new-pass"
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
            />
          </div>
          <button id="change-pass-btn" className="btn-primary" onClick={handleChangePass}>
            Cambiar contraseña
          </button>
          {passStatus && (
            <p id="pass-status" className={`status-msg ${passStatus.includes('correcta') || passStatus.includes('incorrecta') ? 'error' : 'success'}`}>
              {passStatus}
            </p>
          )}
        </section>

        {/* Datos */}
        <section className="settings-section">
          <h3>Datos</h3>
          <button id="export-btn" className="btn-secondary" onClick={handleExport}>
            Exportar JSON
          </button>
          <div className="input-group">
            <label htmlFor="import-file">Importar JSON</label>
            <input id="import-file" type="file" accept=".json" />
          </div>
        </section>

        {/* Logout */}
        <section className="settings-section">
          <button id="logout-btn" className="btn-danger" onClick={onLogout}>
            Cerrar sesión
          </button>
        </section>

      </div>
    </>
  )
}
