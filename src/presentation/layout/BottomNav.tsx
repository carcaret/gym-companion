type View = 'hoy' | 'historial' | 'graficas' | 'ajustes'

const TABS: { id: View; label: string; icon: string }[] = [
  { id: 'hoy', label: 'HOY', icon: '🏋️' },
  { id: 'historial', label: 'HISTORIAL', icon: '📋' },
  { id: 'graficas', label: 'GRÁFICAS', icon: '📈' },
  { id: 'ajustes', label: 'AJUSTES', icon: '⚙️' },
]

interface Props {
  activeView: View
  onNavigate: (view: View) => void
}

export function BottomNav({ activeView, onNavigate }: Props) {
  return (
    <nav id="tab-bar">
      {TABS.map(({ id, label, icon }) => (
        <button
          key={id}
          data-view={id}
          onClick={() => onNavigate(id)}
          aria-current={activeView === id ? 'page' : undefined}
          className={`tab${activeView === id ? ' active' : ''}`}
        >
          <span className="tab-icon">{icon}</span>
          <span className="tab-label">{label}</span>
        </button>
      ))}
    </nav>
  )
}
