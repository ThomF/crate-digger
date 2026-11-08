import { describe, expect, it } from 'vitest'
import {
  MAX_AVATAR_BYTES,
  SOCIAL_PLATFORMS,
  collectorSummary,
  crateCard,
  newsItem,
  profileLinkInput,
  profileLinkUrl,
  publicProfile,
  setVerifiedInput,
  signupInput,
  updateProfileInput,
  usernameParams,
} from '@frisson/shared'

const link = (n: number) => ({ platform: 'website', url: `https://example.com/${n}` })
const ok = (body: Record<string, unknown>) => updateProfileInput.safeParse(body).success

describe('shared profile schemas', () => {
  it('SOCIAL_PLATFORMS is exactly the nine supported platforms, in order', () => {
    expect([...SOCIAL_PLATFORMS]).toEqual([
      'instagram',
      'x',
      'tiktok',
      'youtube',
      'soundcloud',
      'spotify',
      'bandcamp',
      'discogs',
      'website',
    ])
  })

  it('MAX_AVATAR_BYTES is 5 MiB', () => {
    expect(MAX_AVATAR_BYTES).toBe(5 * 1024 * 1024)
  })

  describe('link URLs', () => {
    it.each([
      'https://instagram.com/ada',
      'HTTPS://Example.com/path?q=1#frag',
      '  https://ada.bandcamp.com  ',
    ])('accepts %s', (url) => {
      expect(profileLinkUrl.safeParse(url).success).toBe(true)
    })

    it('trims the URL', () => {
      expect(profileLinkUrl.parse('  https://ada.example  ')).toBe('https://ada.example')
    })

    it.each([
      ['http', 'http://example.com'],
      ['javascript', 'javascript:alert(1)'],
      ['javascript disguised', 'JavaScript:alert(document.cookie)'],
      ['data', 'data:text/html,<script>alert(1)</script>'],
      ['ftp', 'ftp://example.com/file'],
      ['relative', '/users/ada'],
      ['protocol-relative', '//example.com'],
      ['garbage', 'not a url at all'],
      ['empty', ''],
      ['no host', 'https://'],
      ['credentials', 'https://user:pass@example.com'],
      ['username only', 'https://user@example.com'],
    ])('rejects %s', (_name, url) => {
      expect(profileLinkUrl.safeParse(url).success).toBe(false)
    })

    it('rejects URLs over 2048 characters', () => {
      const base = 'https://example.com/'
      expect(profileLinkUrl.safeParse(base + 'a'.repeat(2048 - base.length)).success).toBe(true)
      expect(profileLinkUrl.safeParse(base + 'a'.repeat(2049 - base.length)).success).toBe(false)
    })
  })

  describe('profileLinkInput', () => {
    it('accepts every supported platform', () => {
      for (const platform of SOCIAL_PLATFORMS) {
        expect(profileLinkInput.safeParse({ platform, url: 'https://example.com' }).success).toBe(
          true,
        )
      }
    })

    it('rejects an unknown platform', () => {
      expect(
        profileLinkInput.safeParse({ platform: 'myspace', url: 'https://myspace.com/ada' }).success,
      ).toBe(false)
    })
  })

  describe('updateProfileInput', () => {
    it('fills defaults: bio empty, location null, no links', () => {
      expect(updateProfileInput.parse({ displayName: '  Ada  ' })).toEqual({
        displayName: 'Ada',
        bio: '',
        location: null,
        links: [],
      })
    })

    it('requires a displayName of 1-60 characters', () => {
      expect(ok({})).toBe(false)
      expect(ok({ displayName: '   ' })).toBe(false)
      expect(ok({ displayName: 'a' })).toBe(true)
      expect(ok({ displayName: 'a'.repeat(60) })).toBe(true)
      expect(ok({ displayName: 'a'.repeat(61) })).toBe(false)
    })

    it('accepts a 500 character bio and rejects 501', () => {
      expect(ok({ displayName: 'Ada', bio: 'b'.repeat(500) })).toBe(true)
      expect(ok({ displayName: 'Ada', bio: 'b'.repeat(501) })).toBe(false)
    })

    it('accepts an 80 character location and rejects 81', () => {
      expect(ok({ displayName: 'Ada', location: 'l'.repeat(80) })).toBe(true)
      expect(ok({ displayName: 'Ada', location: 'l'.repeat(81) })).toBe(false)
    })

    it('normalizes an empty or blank location to null and trims the rest', () => {
      expect(updateProfileInput.parse({ displayName: 'Ada', location: '' }).location).toBeNull()
      expect(updateProfileInput.parse({ displayName: 'Ada', location: '   ' }).location).toBeNull()
      expect(updateProfileInput.parse({ displayName: 'Ada', location: null }).location).toBeNull()
      expect(updateProfileInput.parse({ displayName: 'Ada', location: ' Boise ' }).location).toBe(
        'Boise',
      )
    })

    it('accepts 6 links and rejects 7', () => {
      const six = Array.from({ length: 6 }, (_, i) => link(i))
      expect(ok({ displayName: 'Ada', links: six })).toBe(true)
      expect(ok({ displayName: 'Ada', links: [...six, link(6)] })).toBe(false)
    })

    it('allows the same platform more than once', () => {
      expect(ok({ displayName: 'Ada', links: [link(1), link(2)] })).toBe(true)
    })

    it('rejects a link with an unsafe URL or unknown platform', () => {
      expect(
        ok({ displayName: 'Ada', links: [{ platform: 'website', url: 'javascript:alert(1)' }] }),
      ).toBe(false)
      expect(
        ok({ displayName: 'Ada', links: [{ platform: 'myspace', url: 'https://myspace.com' }] }),
      ).toBe(false)
    })

    it.each(['verified', 'role', 'email', 'username', 'avatarUrl', 'id'])(
      'rejects the unknown key %s',
      (key) => {
        expect(ok({ displayName: 'Ada', [key]: key === 'verified' ? true : 'x' })).toBe(false)
      },
    )
  })

  describe('publicProfile', () => {
    it('has no id, email or role keys and strips them if present', () => {
      expect(Object.keys(publicProfile.shape)).not.toEqual(
        expect.arrayContaining(['id', 'email', 'role']),
      )
      for (const key of ['id', 'email', 'role', 'passwordHash']) {
        expect(publicProfile.shape).not.toHaveProperty(key)
      }

      const parsed = publicProfile.parse({
        id: 1,
        email: 'ada@example.com',
        role: 'admin',
        username: 'ada',
        displayName: 'Ada',
        bio: '',
        location: null,
        avatarUrl: null,
        verified: false,
        links: [{ platform: 'x', url: 'https://x.com/ada' }],
        crates: [{ id: 1, name: 'Jazz', color: '#112233', label: null, albumCount: 3 }],
        followerCount: 2,
        followingCount: 1,
        viewerFollows: false,
        isDemo: false,
        demoSeedKey: 'demo-ada',
      })

      expect(Object.keys(parsed).sort()).toEqual([
        'avatarUrl',
        'bio',
        'crates',
        'displayName',
        'followerCount',
        'followingCount',
        'isDemo',
        'links',
        'location',
        'username',
        'verified',
        'viewerFollows',
      ])
    })

    it.each(['followerCount', 'followingCount', 'viewerFollows', 'isDemo'])(
      'requires %s',
      (key) => {
        const complete: Record<string, unknown> = {
          username: 'ada',
          displayName: 'Ada',
          bio: '',
          location: null,
          avatarUrl: null,
          verified: false,
          links: [],
          crates: [],
          followerCount: 0,
          followingCount: 0,
          viewerFollows: false,
          isDemo: false,
        }
        expect(publicProfile.safeParse(complete).success).toBe(true)
        delete complete[key]
        expect(publicProfile.safeParse(complete).success).toBe(false)
      },
    )
  })

  describe('collectorSummary', () => {
    it('strips unknown keys, including id, email and role', () => {
      const parsed = collectorSummary.parse({
        id: 7,
        email: 'ada@example.com',
        role: 'admin',
        demoSeedKey: 'demo-ada',
        username: 'ada',
        displayName: 'Ada',
        avatarUrl: null,
        verified: false,
        isDemo: true,
      })
      expect(Object.keys(parsed).sort()).toEqual([
        'avatarUrl',
        'displayName',
        'isDemo',
        'username',
        'verified',
      ])
    })
  })

  describe('crateCard', () => {
    const card = {
      id: 3,
      name: 'Jazz',
      color: '#112233',
      label: null,
      albumCount: 4,
      createdAt: '2026-11-08T12:00:00.000Z',
      ownerUsername: 'ada',
      ownerDisplayName: 'Ada',
    }

    it('strips unknown keys, including the numeric ownerId', () => {
      const parsed = crateCard.parse({ ...card, ownerId: 7, sortBy: 'manual', sortOrder: 1 })
      expect(Object.keys(parsed).sort()).toEqual(Object.keys(card).sort())
      expect(crateCard.shape).not.toHaveProperty('ownerId')
    })

    it('needs an owner and an ISO createdAt', () => {
      expect(crateCard.safeParse({ ...card, ownerUsername: null }).success).toBe(false)
      expect(crateCard.safeParse({ ...card, createdAt: 'last Tuesday' }).success).toBe(false)
    })
  })

  describe('newsItem', () => {
    const item = {
      id: 1,
      title: 'Headline',
      summary: 'Text',
      source: 'Source',
      publishedAt: '2026-11-08T12:00:00.000Z',
    }

    it('accepts an item and strips unknown keys', () => {
      const parsed = newsItem.parse({ ...item, seedKey: 'news-1' })
      expect(parsed).toEqual(item)
    })

    it('needs an ISO publishedAt', () => {
      expect(newsItem.safeParse({ ...item, publishedAt: 'yesterday' }).success).toBe(false)
    })
  })

  describe('setVerifiedInput', () => {
    it('takes a boolean verified and nothing else', () => {
      expect(setVerifiedInput.safeParse({ verified: true }).success).toBe(true)
      expect(setVerifiedInput.safeParse({ verified: 'yes' }).success).toBe(false)
      expect(setVerifiedInput.safeParse({}).success).toBe(false)
      expect(setVerifiedInput.safeParse({ verified: true, role: 'admin' }).success).toBe(false)
    })
  })

  describe('usernameParams', () => {
    it('uses the signup username rule', () => {
      expect(usernameParams.parse({ username: ' Ada_L ' })).toEqual({ username: 'ada_l' })
      expect(usernameParams.safeParse({ username: 'ab' }).success).toBe(false)
      expect(usernameParams.safeParse({ username: 'a'.repeat(33) }).success).toBe(false)
      expect(usernameParams.safeParse({ username: 'no spaces' }).success).toBe(false)
      expect(usernameParams.safeParse({ username: '../etc' }).success).toBe(false)
    })

    it('signupInput still applies the same username rule', () => {
      const base = { email: 'a@example.com', password: 'long enough' }
      expect(signupInput.parse({ ...base, username: ' Ada_L ' }).username).toBe('ada_l')
      expect(signupInput.safeParse({ ...base, username: 'ab' }).success).toBe(false)
      expect(signupInput.safeParse({ ...base, username: 'bad!' }).success).toBe(false)
    })
  })
})
