import { create } from 'zustand'
import type { DB } from '../../domain/shared/DB'

type ActiveView = 'hoy' | 'historial' | 'graficas' | 'ajustes'

interface AppState {
  db: DB | null
  isAuthenticated: boolean
  activeView: ActiveView
  setDB: (db: DB) => void
  setAuthenticated: (v: boolean) => void
  setActiveView: (view: ActiveView) => void
}

export const useAppStore = create<AppState>((set) => ({
  db: null,
  isAuthenticated: false,
  activeView: 'hoy',
  setDB: (db) => set({ db }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setActiveView: (activeView) => set({ activeView }),
}))
