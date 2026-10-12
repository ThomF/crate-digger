import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Crate } from '@crate-digger/shared'
import { albums } from '../src/db/schema.ts'
import { addCrate, buildTestApp } from './helpers.ts'

describe('GET /api/crates', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>

  beforeEach(async () => {
    app = await buildTestApp()
  })
  afterEach(() => app.close())

  it('lists crates in sort order with album counts, including empty crates', async () => {
    const second = addCrate(app, 'Second', 1)
    const first = addCrate(app, 'First', 0)
    app.db
      .insert(albums)
      .values([
        { crateId: second.id, title: 'A', artist: 'X' },
        { crateId: second.id, title: 'B', artist: 'Y' },
      ])
      .run()

    const res = await app.inject({ url: '/api/crates' })

    expect(res.statusCode).toBe(200)
    expect(res.json<Crate[]>().map((c) => [c.id, c.name, c.albumCount])).toEqual([
      [first.id, 'First', 0],
      [second.id, 'Second', 2],
    ])
  })
})
