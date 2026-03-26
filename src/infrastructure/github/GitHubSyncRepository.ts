import type { ISyncRepository } from '../../domain/sync/ISyncRepository'
import type { DB } from '../../domain/shared/DB'

const GITHUB_API = 'https://api.github.com'

export class GitHubSyncRepository implements ISyncRepository {
  private sha: string | null = null

  constructor(private readonly filePath: string = 'db.json') {}

  async load(repo: string, branch: string, token: string): Promise<DB | null> {
    try {
      const res = await fetch(
        `${GITHUB_API}/repos/${repo}/contents/${this.filePath}?ref=${branch}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' } }
      )
      if (!res.ok) return null
      const data = (await res.json()) as { content: string; sha: string }
      this.sha = data.sha
      const bytes = Uint8Array.from(atob(data.content.replace(/\n/g, '')), (c) => c.charCodeAt(0))
      return JSON.parse(new TextDecoder().decode(bytes)) as DB
    } catch {
      return null
    }
  }

  async save(db: DB, repo: string, branch: string, token: string): Promise<void> {
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(db, null, 2))))
    const body: Record<string, unknown> = {
      message: `Gym Companion update ${new Date().toISOString().split('T')[0]}`,
      content,
      branch,
    }
    if (this.sha) body.sha = this.sha

    const res = await fetch(`${GITHUB_API}/repos/${repo}/contents/${this.filePath}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`GitHub save failed: ${res.status}`)
    const data = (await res.json()) as { content: { sha: string } }
    this.sha = data.content.sha
  }
}
