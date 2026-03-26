import { PasswordChange } from './components/PasswordChange'
import { GitHubConfig } from './components/GitHubConfig'

interface Props {
  onChangePassword: (current: string, next: string) => Promise<void>
  onSaveGitHub: (data: { repo: string; branch: string; path: string; token: string }) => void
  onTestGitHub: (data: { repo: string; branch: string; path: string; token: string }) => void
}

export function SettingsView({ onChangePassword, onSaveGitHub, onTestGitHub }: Props) {
  return (
    <div className="settings-view">
      <h2>Ajustes</h2>
      <section>
        <h3>Sincronización GitHub</h3>
        <GitHubConfig onSave={onSaveGitHub} onTest={onTestGitHub} />
      </section>
      <section>
        <h3>Cambiar contraseña</h3>
        <PasswordChange onChangePassword={onChangePassword} />
      </section>
    </div>
  )
}
