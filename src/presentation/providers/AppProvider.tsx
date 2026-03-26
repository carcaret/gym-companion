import { LocalStorageRepository } from '../../infrastructure/persistence/LocalStorageRepository'
import { WebCryptoService } from '../../infrastructure/crypto/WebCryptoService'
import { GitHubSyncRepository } from '../../infrastructure/github/GitHubSyncRepository'
import { LoginUseCase, LogoutUseCase, ChangePasswordUseCase } from '../../application/auth/AuthUseCases'
import { StartWorkoutUseCase, RecordSeriesUseCase, CompleteWorkoutUseCase } from '../../application/workout/WorkoutUseCases'
import { GetHistoryUseCase, FilterHistoryUseCase } from '../../application/history/HistoryUseCases'
import { GetChartDataUseCase } from '../../application/charts/GetChartDataUseCase'
import { SyncToGitHubUseCase, LoadFromGitHubUseCase } from '../../application/sync/SyncUseCases'

// DI manual — instancias singleton para toda la app
const storage = new LocalStorageRepository()
const crypto = new WebCryptoService()
const syncRepo = new GitHubSyncRepository()

export const useCases = {
  login: new LoginUseCase(storage, crypto),
  logout: new LogoutUseCase(storage),
  changePassword: new ChangePasswordUseCase(storage, crypto),
  startWorkout: new StartWorkoutUseCase(storage),
  recordSeries: new RecordSeriesUseCase(storage),
  completeWorkout: new CompleteWorkoutUseCase(storage),
  getHistory: new GetHistoryUseCase(storage),
  filterHistory: new FilterHistoryUseCase(storage),
  getChartData: new GetChartDataUseCase(storage),
  syncToGitHub: new SyncToGitHubUseCase(storage, syncRepo, crypto),
  loadFromGitHub: new LoadFromGitHubUseCase(storage, syncRepo, crypto),
  storage,
}
