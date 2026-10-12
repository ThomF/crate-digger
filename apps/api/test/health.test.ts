import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'

describe('GET /api/health', () => {
  it('reports ok, including the database', async () => {
    const app = await buildApp({ dbPath: ':memory:' })

    const res = await app.inject({ method: 'GET', url: '/api/health' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok', service: 'crate-digger-api', db: 'ok' })
    await app.close()
  })
})
