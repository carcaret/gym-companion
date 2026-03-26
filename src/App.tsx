import { useEffect, useState } from 'react'
import { useCases } from './presentation/providers/AppProvider'
import { BottomNav } from './presentation/layout/BottomNav'
import { LoginView } from './presentation/features/auth/LoginView'
import { HoyView } from './presentation/features/workout/HoyView'
import { HistorialView } from './presentation/features/history/HistorialView'
import { GraficasView } from './presentation/features/charts/GraficasView'
import { AjustesView } from './presentation/features/settings/AjustesView'
import type { DB, DayOfWeek } from './domain/shared/DB'

type View = 'hoy' | 'historial' | 'graficas' | 'ajustes'

type ModalState =
  | { type: 'add-exercise' }
  | { type: 'confirm-remove'; exerciseIdx: number }
  | { type: 'confirm-delete'; entryDate: string }
  | null

const DAY_MAP: Record<number, DayOfWeek> = { 1: 'LUNES', 3: 'MIERCOLES', 5: 'VIERNES' }

export function App() {
  const [db, setDB] = useState<DB | null>(null)
  const [isAuthenticated, setAuthenticated] = useState(false)
  const [activeView, setActiveView] = useState<View>('hoy')
  const [modalState, setModalState] = useState<ModalState>(null)
  const [exerciseSearch, setExerciseSearch] = useState('')

  const todayStr = new Date().toISOString().split('T')[0]
  const dayType = DAY_MAP[new Date().getDay()] ?? null

  useEffect(() => {
    const session = useCases.storage.getSession()
    const localDB = useCases.storage.load()
    if (
      session &&
      localDB &&
      localDB.auth.username === session.user &&
      localDB.auth.passwordHash === session.hash
    ) {
      setDB(localDB)
      setAuthenticated(true)
    }
  }, [])

  function handleUpdateDB(updater: (db: DB) => DB) {
    setDB((prev) => {
      const next = updater(prev!)
      useCases.storage.save(next)
      return next
    })
  }

  async function handleLogin(user: string, pass: string) {
    const loadedDB = await useCases.login.execute(user, pass)
    setDB(loadedDB)
    setAuthenticated(true)
  }

  function handleLogout() {
    useCases.logout.execute()
    setAuthenticated(false)
    setDB(null)
    setModalState(null)
  }

  async function handleChangePassword(oldPass: string, newPass: string) {
    await useCases.changePassword.execute(oldPass, newPass)
    const updated = useCases.storage.load()
    if (updated) setDB(updated)
  }

  function handleConfirmRemove(exerciseIdx: number) {
    handleUpdateDB((d) => ({
      ...d,
      history: d.history.map((h) => {
        if (h.date !== todayStr) return h
        return { ...h, logs: h.logs.filter((_, i) => i !== exerciseIdx) }
      }),
    }))
    setModalState(null)
  }

  function handleConfirmDelete(entryDate: string) {
    handleUpdateDB((d) => ({
      ...d,
      history: d.history.filter((h) => h.date !== entryDate),
    }))
    setModalState(null)
  }

  function handleAddExercise(exerciseId: string) {
    if (!db) { setModalState(null); return }
    const exercise = db.exercises[exerciseId]
    if (!exercise) { setModalState(null); return }
    const activeEntry = db.history.find((h) => h.date === todayStr && !h.completed)
    if (activeEntry) {
      const prev = db.history
        .filter((h) => h.type === activeEntry.type)
        .flatMap((h) => h.logs)
        .filter((l) => l.exercise_id === exerciseId)
        .at(-1)
      handleUpdateDB((d) => ({
        ...d,
        history: d.history.map((h) => {
          if (h.date !== todayStr) return h
          const newLog = {
            exercise_id: exerciseId,
            name: exercise.name,
            series: prev?.series ?? 3,
            reps: {
              expected: prev?.reps.expected ?? 10,
              actual: new Array(prev?.series ?? 3).fill(null) as null[],
            },
            weight: prev?.weight ?? 0,
          }
          return { ...h, logs: [...h.logs, newLog] }
        }),
      }))
    }
    setModalState(null)
  }

  const filteredExercises = db
    ? Object.values(db.exercises).filter((ex) =>
        ex.name.toLowerCase().includes(exerciseSearch.toLowerCase())
      )
    : []

  return (
    <>
      {/* Login screen */}
      <div id="login-screen" hidden={isAuthenticated}>
        <LoginView onLogin={handleLogin} />
      </div>

      {/* App shell */}
      <div id="app-shell" hidden={!isAuthenticated}>
        <div id="view-hoy" className="view" hidden={activeView !== 'hoy'}>
          {db && (
            <HoyView
              db={db}
              todayStr={todayStr}
              dayType={dayType}
              onUpdateDB={handleUpdateDB}
              onModalRequest={(s) => { setExerciseSearch(''); setModalState(s) }}
            />
          )}
        </div>

        <div id="view-historial" className="view" hidden={activeView !== 'historial'}>
          {db && (
            <HistorialView
              db={db}
              onUpdateDB={handleUpdateDB}
              onModalRequest={(s) => setModalState(s)}
            />
          )}
        </div>

        <div id="view-graficas" className="view" hidden={activeView !== 'graficas'}>
          {db && <GraficasView db={db} />}
        </div>

        <div id="view-ajustes" className="view" hidden={activeView !== 'ajustes'}>
          {db && (
            <AjustesView
              db={db}
              onChangePassword={handleChangePassword}
              onLogout={handleLogout}
            />
          )}
        </div>

        <BottomNav activeView={activeView} onNavigate={setActiveView} />
      </div>

      {/* Single modal overlay */}
      <div id="modal-overlay" hidden={!modalState}>
        {modalState?.type === 'add-exercise' && (
          <div className="modal" id="modal-box">
            <h3 id="modal-title">Añadir ejercicio</h3>
            <input
              id="exercise-search-input"
              type="text"
              placeholder="Buscar ejercicio..."
              value={exerciseSearch}
              onChange={(e) => setExerciseSearch(e.target.value)}
              autoFocus
            />
            <ul id="exercise-modal-list">
              {filteredExercises.map((ex) => (
                <li key={ex.id} onClick={() => handleAddExercise(ex.id)} style={{ cursor: 'pointer' }}>
                  {ex.name}
                </li>
              ))}
            </ul>
            <div className="modal-actions" id="modal-actions">
              <button className="btn-secondary" onClick={() => setModalState(null)}>Cancelar</button>
            </div>
          </div>
        )}

        {modalState?.type === 'confirm-remove' && (
          <div className="modal" id="modal-box">
            <h3 id="modal-title">Quitar ejercicio</h3>
            <p>¿Quitar este ejercicio del entreno?</p>
            <div className="modal-actions" id="modal-actions">
              <button className="btn-secondary" onClick={() => setModalState(null)}>Cancelar</button>
              <button className="btn-danger" onClick={() => handleConfirmRemove((modalState as { type: 'confirm-remove'; exerciseIdx: number }).exerciseIdx)}>
                Quitar
              </button>
            </div>
          </div>
        )}

        {modalState?.type === 'confirm-delete' && (
          <div className="modal" id="modal-box">
            <h3 id="modal-title">Borrar entrada</h3>
            <p>¿Borrar este entreno del historial?</p>
            <div className="modal-actions" id="modal-actions">
              <button className="btn-secondary" onClick={() => setModalState(null)}>Cancelar</button>
              <button className="btn-danger" onClick={() => handleConfirmDelete((modalState as { type: 'confirm-delete'; entryDate: string }).entryDate)}>
                Borrar
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
