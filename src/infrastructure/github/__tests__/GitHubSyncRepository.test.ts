import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GitHubSyncRepository } from '../GitHubSyncRepository'
import type { DB } from '../../../domain/shared/DB'

const stubDB: DB = {
  auth: { username: 'carlos', passwordHash: 'hash' },
  exercises: {},
  routines: { LUNES: [], MIERCOLES: [], VIERNES: [] },
  history: [],
}

const stubRepo = 'user/repo'
const stubBranch = 'master'
const stubToken = 'ghp_token'
const stubPath = 'db.json'

describe('GitHubSyncRepository', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('load: devuelve la DB decodificada cuando la respuesta es ok', async () => {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(stubDB))))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: encoded + '\n', sha: 'abc123' }),
    }))

    const sut = new GitHubSyncRepository(stubPath)
    const result = await sut.load(stubRepo, stubBranch, stubToken)
    expect(result).toEqual(stubDB)
  })

  it('load: devuelve null cuando la respuesta no es ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    const sut = new GitHubSyncRepository(stubPath)
    expect(await sut.load(stubRepo, stubBranch, stubToken)).toBeNull()
  })

  it('save: llama a fetch PUT con el contenido correcto', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: { sha: 'newsha' } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const sut = new GitHubSyncRepository(stubPath)
    await sut.save(stubDB, stubRepo, stubBranch, stubToken)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(stubRepo),
      expect.objectContaining({ method: 'PUT' })
    )
  })
})
