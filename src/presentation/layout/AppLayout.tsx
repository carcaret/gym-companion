import { useAppStore } from '../store/useAppStore'
import { BottomNav } from './BottomNav'

interface Props {
  children: React.ReactNode
}

export function AppLayout({ children }: Props) {
  const { activeView, setActiveView } = useAppStore()
  return (
    <div className="app-container">
      <main className="view-container">{children}</main>
      <BottomNav activeView={activeView} onNavigate={setActiveView} />
    </div>
  )
}
