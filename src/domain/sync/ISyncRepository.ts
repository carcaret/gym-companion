import type { DB } from '../shared/DB'

export interface ISyncRepository {
  load(repo: string, branch: string, token: string): Promise<DB | null>
  save(db: DB, repo: string, branch: string, token: string): Promise<void>
}
