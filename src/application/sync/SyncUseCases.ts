import type { ISyncRepository } from '../../domain/sync/ISyncRepository'
import type { ICryptoService } from '../../domain/auth/ICryptoService'
import type { LocalStorageRepository } from '../../infrastructure/persistence/LocalStorageRepository'

type Storage = Pick<LocalStorageRepository, 'load' | 'save'>

const GITHUB_KEY = 'gym_companion_github'
const PAT_KEY = 'gym_companion_pat_enc'

export interface GitHubConfig {
  repo: string
  branch: string
  path: string
}

export class SyncToGitHubUseCase {
  constructor(
    private storage: Storage,
    private syncRepo: ISyncRepository,
    private crypto: ICryptoService
  ) {}

  async execute(password: string): Promise<void> {
    const db = this.storage.load()
    if (!db) throw new Error('Sin datos')
    const cfg = this.getConfig()
    const pat = this.getPAT(password)
    if (!cfg || !pat) throw new Error('GitHub no configurado')
    await this.syncRepo.save(db, cfg.repo, cfg.branch, pat)
  }

  private getConfig(): GitHubConfig | null {
    try {
      const raw = localStorage.getItem(GITHUB_KEY)
      return raw ? (JSON.parse(raw) as GitHubConfig) : null
    } catch {
      return null
    }
  }

  private getPAT(password: string): string | null {
    const enc = localStorage.getItem(PAT_KEY)
    if (!enc) return null
    try {
      return this.crypto.xorDecrypt(enc, password)
    } catch {
      return null
    }
  }
}

export class LoadFromGitHubUseCase {
  constructor(
    private storage: Storage,
    private syncRepo: ISyncRepository,
    private crypto: ICryptoService
  ) {}

  async execute(password: string, patOverride?: string): Promise<boolean> {
    const cfg = this.getConfig()
    const pat = patOverride ?? this.getPAT(password)
    if (!cfg || !pat) return false
    const db = await this.syncRepo.load(cfg.repo, cfg.branch, pat)
    if (!db) return false
    this.storage.save(db)
    return true
  }

  private getConfig(): GitHubConfig | null {
    try {
      const raw = localStorage.getItem(GITHUB_KEY)
      return raw ? (JSON.parse(raw) as GitHubConfig) : null
    } catch {
      return null
    }
  }

  private getPAT(password: string): string | null {
    const enc = localStorage.getItem(PAT_KEY)
    if (!enc) return null
    try {
      return this.crypto.xorDecrypt(enc, password)
    } catch {
      return null
    }
  }
}
