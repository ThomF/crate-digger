import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { PublicProfile, PublicUser } from '@frisson/shared'
import * as api from '../api/auth.ts'
import * as profiles from '../api/profiles.ts'
import { useSessionStore } from './session.ts'

vi.mock('../api/auth.ts', () => ({
  me: vi.fn(),
  logIn: vi.fn(),
  signUp: vi.fn(),
  logOut: vi.fn(),
}))

vi.mock('../api/profiles.ts', () => ({
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
  removeAvatar: vi.fn(),
}))

const alice: PublicUser = {
  id: 1,
  email: 'alice@example.com',
  username: 'alice',
  displayName: 'Alice',
  role: 'user',
  avatarUrl: null,
  verified: false,
}
const admin: PublicUser = { ...alice, id: 2, username: 'boss', role: 'admin' }

describe('session store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('session store loads the current user, logs in, signs up and logs out', async () => {
    const session = useSessionStore()
    expect(session.signedIn).toBe(false)

    // Load: signed out (me() answers null), asked only once.
    vi.mocked(api.me).mockResolvedValue(null)
    await session.load()
    await session.load()
    expect(api.me).toHaveBeenCalledTimes(1)
    expect(session.loaded).toBe(true)
    expect(session.user).toBeNull()
    expect(session.signedIn).toBe(false)

    // Log in
    vi.mocked(api.logIn).mockResolvedValue(admin)
    await session.logIn('boss@example.com', 'hunter22hunter')
    expect(api.logIn).toHaveBeenCalledWith({
      email: 'boss@example.com',
      password: 'hunter22hunter',
    })
    expect(session.user).toEqual(admin)
    expect(session.signedIn).toBe(true)
    expect(session.isAdmin).toBe(true)

    // Log out
    vi.mocked(api.logOut).mockResolvedValue(undefined)
    await session.logOut()
    expect(api.logOut).toHaveBeenCalledTimes(1)
    expect(session.user).toBeNull()
    expect(session.signedIn).toBe(false)
    expect(session.isAdmin).toBe(false)

    // Sign up
    const input = { email: 'alice@example.com', username: 'alice', password: 'longenough' }
    vi.mocked(api.signUp).mockResolvedValue(alice)
    await session.signUp(input)
    expect(api.signUp).toHaveBeenCalledWith(input)
    expect(session.user).toEqual(alice)
    expect(session.signedIn).toBe(true)
    expect(session.isAdmin).toBe(false)
  })

  it('loads a signed-in user and retries after a failed load', async () => {
    const session = useSessionStore()
    vi.mocked(api.me).mockRejectedValueOnce(new TypeError('offline'))
    await session.load()
    expect(session.signedIn).toBe(false)

    vi.mocked(api.me).mockResolvedValueOnce(alice)
    await session.load()
    expect(api.me).toHaveBeenCalledTimes(2)
    expect(session.user).toEqual(alice)
  })

  it('stays signed out when logging in fails', async () => {
    const session = useSessionStore()
    vi.mocked(api.logIn).mockRejectedValue(new Error('Email or password is incorrect'))
    await expect(session.logIn('a@example.com', 'wrong')).rejects.toThrow('incorrect')
    expect(session.signedIn).toBe(false)
  })

  describe('refresh after profile changes', () => {
    const profile: PublicProfile = {
      username: 'alice',
      displayName: 'Alice Cooper',
      bio: '',
      location: null,
      avatarUrl: null,
      verified: false,
      links: [],
      crates: [],
      favorites: [],
      followerCount: 0,
      followingCount: 0,
      viewerFollows: false,
      isDemo: false,
    }

    it('refresh replaces the user with a fresh /auth/me answer', async () => {
      const session = useSessionStore()
      vi.mocked(api.me).mockResolvedValueOnce(alice)
      await session.load()
      const renamed = { ...alice, displayName: 'Alice Cooper' }
      vi.mocked(api.me).mockResolvedValueOnce(renamed)
      await session.refresh()
      expect(api.me).toHaveBeenCalledTimes(2)
      expect(session.user).toEqual(renamed)
    })

    it('saveProfile updates the profile, then refreshes the user', async () => {
      const session = useSessionStore()
      vi.mocked(api.logIn).mockResolvedValue(alice)
      await session.logIn('alice@example.com', 'longenough')
      vi.mocked(profiles.updateProfile).mockResolvedValue(profile)
      vi.mocked(api.me).mockResolvedValue({ ...alice, displayName: 'Alice Cooper' })

      const input = { displayName: 'Alice Cooper' }
      await expect(session.saveProfile(input)).resolves.toEqual(profile)
      expect(profiles.updateProfile).toHaveBeenCalledWith(input)
      expect(api.me).toHaveBeenCalledTimes(1)
      expect(session.user?.displayName).toBe('Alice Cooper')
    })

    it('saveAvatar uploads the file, then refreshes the user', async () => {
      const session = useSessionStore()
      vi.mocked(api.logIn).mockResolvedValue(alice)
      await session.logIn('alice@example.com', 'longenough')
      const avatarUrl = '/avatars/1.png'
      vi.mocked(profiles.uploadAvatar).mockResolvedValue({ ...profile, avatarUrl })
      vi.mocked(api.me).mockResolvedValue({ ...alice, avatarUrl })

      const file = new File(['png'], 'me.png', { type: 'image/png' })
      await session.saveAvatar(file)
      expect(profiles.uploadAvatar).toHaveBeenCalledWith(file)
      expect(api.me).toHaveBeenCalledTimes(1)
      expect(session.user?.avatarUrl).toBe(avatarUrl)
    })

    it('deleteAvatar removes the avatar, then refreshes the user', async () => {
      const session = useSessionStore()
      vi.mocked(api.logIn).mockResolvedValue({ ...alice, avatarUrl: '/avatars/1.png' })
      await session.logIn('alice@example.com', 'longenough')
      vi.mocked(profiles.removeAvatar).mockResolvedValue(profile)
      vi.mocked(api.me).mockResolvedValue(alice)

      await session.deleteAvatar()
      expect(profiles.removeAvatar).toHaveBeenCalledTimes(1)
      expect(api.me).toHaveBeenCalledTimes(1)
      expect(session.user?.avatarUrl).toBeNull()
    })

    it('does not refresh when the change fails', async () => {
      const session = useSessionStore()
      vi.mocked(profiles.updateProfile).mockRejectedValue(new Error('Bio is too long'))
      await expect(session.saveProfile({ displayName: 'Alice', bio: 'x' })).rejects.toThrow(
        'too long',
      )
      expect(api.me).not.toHaveBeenCalled()
    })
  })
})
