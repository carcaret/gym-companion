import { useState } from 'react'

interface GitHubFormData {
  repo: string
  branch: string
  path: string
  token: string
}

interface Props {
  onSave: (data: GitHubFormData) => void
  onTest: (data: GitHubFormData) => void
  initialValues?: Partial<GitHubFormData>
}

export function GitHubConfig({ onSave, onTest, initialValues }: Props) {
  const [repo, setRepo] = useState(initialValues?.repo ?? '')
  const [branch, setBranch] = useState(initialValues?.branch ?? 'master')
  const [path, setPath] = useState(initialValues?.path ?? 'db.json')
  const [token, setToken] = useState(initialValues?.token ?? '')

  const data = (): GitHubFormData => ({ repo, branch, path, token })

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(data()) }}>
      <label htmlFor="gh-repo">Repositorio (usuario/repo)</label>
      <input id="gh-repo" value={repo} onChange={(e) => setRepo(e.target.value)} />
      <label htmlFor="gh-branch">Rama</label>
      <input id="gh-branch" value={branch} onChange={(e) => setBranch(e.target.value)} />
      <label htmlFor="gh-path">Ruta del archivo</label>
      <input id="gh-path" value={path} onChange={(e) => setPath(e.target.value)} />
      <label htmlFor="gh-token">Token de acceso (PAT)</label>
      <input id="gh-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} />
      <button type="submit">Guardar configuración</button>
      <button type="button" onClick={() => onTest(data())}>Probar conexión</button>
    </form>
  )
}
