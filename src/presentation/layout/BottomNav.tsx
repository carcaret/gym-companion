type View = 'hoy' | 'historial' | 'graficas' | 'ajustes'

const TABS: { id: View; label: string; icon: string }[] = [
  { id: 'hoy', label: 'Hoy', icon: '🏋️' },
  { id: 'historial', label: 'Historial', icon: '📋' },
  { id: 'graficas', label: 'Gráficas', icon: '📈' },
  { id: 'ajustes', label: 'Ajustes', icon: '⚙️' },
]

interface Props {
  activeView: View
  onNavigate: (view: View) => void
}

export function BottomNav({ activeView, onNavigate }: Props) {
  return (
    <nav className="bottom-nav">
      {TABS.map(({ id, label, icon }) => (
        <button
          key={id}
          onClick={() => onNavigate(id)}
          aria-current={activeView === id ? 'page' : undefined}
          className={`nav-tab${activeView === id ? ' active' : ''}`}
        >
          <span>{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
