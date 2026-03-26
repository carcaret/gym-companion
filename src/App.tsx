import { useEffect } from 'react'
import { useAppStore } from './presentation/store/useAppStore'
import { AppLayout } from './presentation/layout/AppLayout'
import { LoginView } from './presentation/features/auth/LoginView'
import { WorkoutView } from './presentation/features/workout/WorkoutView'
import { HistoryView } from './presentation/features/history/HistoryView'
import { ChartsView } from './presentation/features/charts/ChartsView'
import { SettingsView } from './presentation/features/settings/SettingsView'
import { useCases } from './presentation/providers/AppProvider'
import type { DayOfWeek } from './domain/shared/DB'

const DAY_MAP: Record<number, DayOfWeek> = { 1: 'LUNES', 3: 'MIERCOLES', 5: 'VIERNES' }

function todayDayType(): DayOfWeek | null {
  return DAY_MAP[new Date().getDay()] ?? null
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export function App() {
  const { db, isAuthenticated, activeView, setDB, setAuthenticated } = useAppStore()

  useEffect(() => {
    const session = useCases.storage.getSession()
    const localDB = useCases.storage.load()
    if (session && localDB && localDB.auth.username === session.user && localDB.auth.passwordHash === session.hash) {
      setDB(localDB)
      setAuthenticated(true)
    }
  }, [setDB, setAuthenticated])

  if (!isAuthenticated) {
    return (
      <LoginView
        onLogin={async (user, pass) => {
          const loadedDB = await useCases.login.execute(user, pass)
          setDB(loadedDB)
          setAuthenticated(true)
        }}
      />
    )
  }

  const dayType = todayDayType()
  const today = todayStr()
  const todayEntry = db?.history.find((h) => h.date === today) ?? null

  return (
    <AppLayout>
      {activeView === 'hoy' && (
        <WorkoutView
          entry={todayEntry}
          dayType={dayType}
          onStart={() => {
            if (!dayType) return
            const entry = useCases.startWorkout.execute(dayType, today)
            setDB({ ...db!, history: [...(db?.history.filter((h) => h.date !== today) ?? []), entry] })
          }}
          onSeriesUpdate={(exerciseId, seriesIndex, reps) => {
            useCases.recordSeries.execute(today, exerciseId, seriesIndex, reps)
            setDB(useCases.storage.load()!)
          }}
          onComplete={() => {
            useCases.completeWorkout.execute(today)
            setDB(useCases.storage.load()!)
          }}
        />
      )}
      {activeView === 'historial' && (() => {
        const entries = useCases.getHistory.execute()
        return (
          <HistoryView
            entries={entries}
            onFilter={() => {}}
            activeFilter={null}
          />
        )
      })()}
      {activeView === 'graficas' && db && (
        <ChartsView
          exercises={db.exercises}
          chartData={useCases.getChartData.execute('', null, null)}
          selectedExercise=""
          onExerciseChange={() => {}}
          onDateChange={() => {}}
          dateFrom=""
          dateTo=""
        />
      )}
      {activeView === 'ajustes' && (
        <SettingsView
          onChangePassword={(current, next) => useCases.changePassword.execute(current, next)}
          onSaveGitHub={() => {}}
          onTestGitHub={() => {}}
        />
      )}
    </AppLayout>
  )
}
